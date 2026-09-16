import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { saveAnswer as saveAnswerToDb, normalizeAssessmentType, type AssessmentType } from "@/lib/assessment-core/db"
import { reconcileStudentFinalGradeFlags } from "@/lib/assessment-core/submit"
import { getDocumentAtTime } from "@/lib/typing-replay"
import { isCodeAnswerCorrupt, extractCodeForValidation } from "@/lib/code-answer-validation"
import {
  assessmentUsesSectionWeightedGrade,
  parseAssessmentSectionConfig,
  type SectionConfig,
} from "@/lib/assessment-sections"
import { clearRequiresReviewForAutoGradedAnswers, clearRequiresReviewForEmptyAnswers } from "@/lib/finalize-recalc-cleanup"
import { recalculateAttemptScore, RecalculateRateLimitError } from "@/lib/recalculate-score"
import {
  buildPerQuestionEffectivePoints,
  capQuestionPoints,
  computeSectionWeightedScore,
} from "@/lib/section-weighted-attempt-score"
import { resolveSectionQuestionSelectionsForAttempt } from "@/lib/load-section-question-selections"
import { createInstructorNotification } from "@/lib/create-instructor-notification"
import { setResultsFinalized } from "@/lib/results-finalized"
import { createNotification } from "@/lib/create-notification"
import { requireAttemptOwnership } from "@/lib/student-api-auth"

// Use Node runtime for quiz finalization (database-heavy operation)
export const dynamic = 'force-dynamic'
export const runtime = "nodejs"
export const maxDuration = 30 // Finalize only - no evaluation; answers already evaluated per-question

export async function POST(request: NextRequest) {
  const perfStart = Date.now()
  try {
    const { attemptId, quizId, violationReason, reason, autoSubmitted, submissionStalled, answers: answersPayload } = await request.json()
    // Support both 'reason' and 'violationReason' for compatibility
    const violationReasonValue = reason || violationReason

    if (!attemptId || !quizId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // SECURITY: finalize took only attemptId/quizId and looked up the owning
    // student AFTER writing, so any caller could finalize (or re-score) a
    // stranger's attempt.
    const finalizeAuth = await requireAttemptOwnership(request, Number(attemptId))
    if (!finalizeAuth.ok) return finalizeAuth.response

    const isRecalculateOnly =
      !violationReasonValue &&
      !autoSubmitted &&
      !submissionStalled &&
      (!Array.isArray(answersPayload) || answersPayload.length === 0)

    if (isRecalculateOnly) {
      const existing = await sql`
        SELECT completed_at FROM quiz_attempts
        WHERE id = ${attemptId} AND quiz_id = ${quizId} AND deleted_at IS NULL
        LIMIT 1
      `
      if (existing.length > 0 && existing[0].completed_at) {
        try {
          const recalc = await recalculateAttemptScore(Number(attemptId), Number(quizId))
          return NextResponse.json({
            success: true,
            attemptId: recalc.attemptId,
            score: recalc.score,
            correctCount: recalc.correctCount,
            actualPointsEarned: recalc.actualPointsEarned,
            totalPossiblePoints: recalc.totalPossiblePoints,
            totalQuestions: recalc.totalQuestions,
            answeredCount: recalc.answeredCount,
            recalculated: true,
          })
        } catch (err) {
          if (err instanceof RecalculateRateLimitError) {
            return NextResponse.json(
              { error: err.message, retryAfterMs: err.retryAfterMs },
              { status: 429 },
            )
          }
          throw err
        }
      }
    }

    // Get quiz configuration
    const quizResult = await sql`
      SELECT 
        q.assessment_type,
        q.section_config,
        COUNT(qq.id) as total
      FROM quizzes q
      LEFT JOIN quiz_questions qq ON q.id = qq.quiz_id
      WHERE q.id = ${quizId}
      GROUP BY q.assessment_type, q.section_config
    `
    
    if (quizResult.length === 0) {
      console.error("[Finalize] Quiz not found:", quizId)
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 })
    }

    // Empty answers scored 0 are valid — clear mistaken requires_review before scoring / PND flags
    try {
      const cleared = await clearRequiresReviewForEmptyAnswers(Number(attemptId))
      if (cleared > 0) {
        console.log(`[Finalize] Cleared requires_review on ${cleared} empty answer(s) for attempt ${attemptId}`)
      }
      const autoCleared = await clearRequiresReviewForAutoGradedAnswers(Number(attemptId))
      if (autoCleared > 0) {
        console.log(`[Finalize] Cleared requires_review on ${autoCleared} auto-graded answer(s) for attempt ${attemptId}`)
      }
    } catch (e) {
      console.warn("[Finalize] clearRequiresReviewForEmptyAnswers (non-fatal):", e)
    }
    
    const quizType = quizResult[0]?.assessment_type
    const sectionConfig = parseAssessmentSectionConfig(
      quizResult[0]?.section_config as SectionConfig[] | string | null | undefined,
    )
    const useSectionWeighting = assessmentUsesSectionWeightedGrade(quizType, sectionConfig)
    const totalQuestions = Number(quizResult[0]?.total) || 0

    // Persist answers from payload that may not be in DB yet (e.g. network failed during per-question save).
    // NO evaluation - answers are already evaluated per-question during the quiz.
    // Unsaved answers get 0 points and requires_review for instructor to evaluate.
    if (Array.isArray(answersPayload) && answersPayload.length > 0) {
      const assessmentType = normalizeAssessmentType(quizType) as AssessmentType
      const existing = await sql`
        SELECT question_id FROM quiz_answers WHERE attempt_id = ${attemptId}
      `
      const existingQids = new Set((existing as { question_id: number }[]).map((r) => r.question_id))

      for (const item of answersPayload) {
        const { questionId, answer, questionType, plotImage, typingReplay, timeSpentSeconds } = item
        if (!questionId || answer === undefined) continue
        if (existingQids.has(questionId)) continue // Already saved during quiz - skip

        const qt = (questionType || "mcq").toLowerCase()
        const isCodeQ = ["code_write", "code_problem", "debug_code", "code_explain", "code_write_plot", "code_debug"].includes(qt)
        let toStore = typeof answer === "string" ? answer : JSON.stringify(answer)
        const codeToCheck = extractCodeForValidation(answer, qt)
        // CRITICAL: Never store corrupt code - derive from typing_replay when possible
        const looksCorrupt = isCodeQ && codeToCheck != null && isCodeAnswerCorrupt(codeToCheck)
        if (looksCorrupt && typingReplay?.events?.length) {
          const lastT = Math.max(...typingReplay.events.map((e: { t?: number }) => e.t ?? 0), 0)
          const derived = getDocumentAtTime(typingReplay as any, lastT + 1000)
          if (derived?.trim() && derived.length > (String(codeToCheck).length || 0)) {
            toStore = qt === "code_write_plot" && plotImage
              ? JSON.stringify({ code: derived, plotImage })
              : derived
          }
        }
        const timeSpent = timeSpentSeconds != null && timeSpentSeconds >= 0 ? timeSpentSeconds : null
        const answerData: Record<string, unknown> = { questionType: qt }
        if (typingReplay?.events?.length) answerData.typing_replay = typingReplay
        if (qt === "code_write_plot" && plotImage) answerData.plotImage = plotImage
        if (isCodeQ && toStore) {
          const codeForData = qt === "code_write_plot" && typeof toStore === "string" && toStore.startsWith("{")
            ? (() => { try { const p = JSON.parse(toStore); return p?.code ?? toStore } catch { return toStore } })()
            : toStore
          answerData.code = typeof codeForData === "string" ? codeForData : JSON.stringify(codeForData)
        }

        await saveAnswerToDb(assessmentType, {
          attemptId,
          questionId,
          selectedAnswer: toStore,
          isCorrect: false,
          pointsEarned: 0,
          answerData: Object.keys(answerData).length > 1 ? answerData : undefined,
          requiresReview: true,
          timeSpentSeconds: timeSpent,
        })
      }
    }

    // Default-safe values in case scoring fails for any reason
    let actualPointsEarned = 0
    let answeredQuestionsPoints = 0
    let answeredCount = 0
    let totalQuizPoints = 0
    let actualTotalQuestionCount = totalQuestions
    let correctCount = 0
    let finalScore = 0
    let storedTotalQuestions = totalQuestions

    try {
      // Calculate actual points earned from individual question scores (no re-evaluation)
      // CRITICAL: Use one answer per question (latest by id) - prevents double-counting if duplicate
      // answers exist (legacy data, migration bugs). Each question can only contribute once.
      // Effective points: override_points (instructor) then points_earned; cap at max per question
      const scoreResult = await sql`
        WITH latest_per_question AS (
          SELECT DISTINCT ON (qa.question_id)
            qa.id, qa.question_id, qa.points_earned, qa.override_points, qa.is_correct,
            COALESCE(qq.max_points, qq.points, 1) as max_pts
          FROM quiz_answers qa
          JOIN quiz_questions qq ON qa.question_id = qq.id
          WHERE qa.attempt_id = ${attemptId}
          ORDER BY qa.question_id, qa.id DESC
        )
        SELECT 
          COALESCE(SUM(
            LEAST(
              COALESCE(
                l.override_points,
                l.points_earned,
                CASE WHEN l.is_correct = true THEN l.max_pts ELSE 0 END,
                0
              )::numeric,
              l.max_pts::numeric
            )
          ), 0)::numeric as actual_points_earned,
          COALESCE(SUM(l.max_pts), 0)::numeric as total_possible_points,
          COUNT(l.id)::int as answered_count
        FROM latest_per_question l
      `

      // Also get the total possible points for ALL questions in the quiz (including unanswered)
      // Use COALESCE(max_points, points, 1) to get the correct point value
      // CRITICAL: This calculation is dynamic and works for ANY number of questions
      // Example: 20 questions at 5 points each = 100 total points
      // Example: 15 questions at 3 points each = 45 total points
      // Example: Mixed points (5, 3, 2, etc.) = sum of all max_points
      const totalQuizPointsResult = await sql`
        SELECT 
          SUM(COALESCE(qq.max_points, qq.points, 1)) as total_quiz_points,
          COUNT(qq.id) as total_question_count
        FROM quiz_questions qq
        WHERE qq.quiz_id = ${quizId}
      `

      actualPointsEarned = Number(scoreResult[0]?.actual_points_earned) || 0
      answeredQuestionsPoints = Number(scoreResult[0]?.total_possible_points) || 0
      answeredCount = Number(scoreResult[0]?.answered_count) || 0
      totalQuizPoints = Number(totalQuizPointsResult[0]?.total_quiz_points) || 0
      actualTotalQuestionCount = Number(totalQuizPointsResult[0]?.total_question_count) || totalQuestions
      
      // 🔒 CRITICAL VALIDATION: Ensure answers were actually saved
      // This prevents the data loss bug where scores are calculated but answers aren't saved
      // IMPORTANT: Allow finalization even with 0 answers if student is exiting early
      // The score will be 0, but the attempt will be marked as completed
      // Note: Early exits are handled gracefully with 0 score
      
      // Warning if answered count is suspiciously low (less than 20% of questions)
      // But don't block finalization - students may exit early
      // Note: Early exits are handled gracefully

      // Calculate correct count (number of correct answers) for backwards compatibility
      const correctCountResult = await sql`
        SELECT COUNT(*) as correct_count
        FROM quiz_answers qa
        WHERE qa.attempt_id = ${attemptId} AND qa.is_correct = true
      `
      correctCount = Number(correctCountResult[0]?.correct_count) || 0

      // SCORING SYSTEM:
      if (useSectionWeighting) {
        const allQuestionsResult = await sql`
          SELECT id, question_type, COALESCE(max_points, points, 1) as max_pts
          FROM quiz_questions
          WHERE quiz_id = ${quizId}
          ORDER BY question_order ASC NULLS LAST, id ASC
        `
        const allQuestions = allQuestionsResult as Array<{
          id: number
          question_type: string
          max_pts: number
        }>
        const answersDetail = await sql`
          WITH latest_per_question AS (
            SELECT DISTINCT ON (qa.question_id)
              qa.question_id, qa.override_points, qa.points_earned
            FROM quiz_answers qa
            WHERE qa.attempt_id = ${attemptId}
            ORDER BY qa.question_id, qa.id DESC
          )
          SELECT * FROM latest_per_question
        `
        const answersByQid = new Map<
          number,
          { override_points: number | null; points_earned: number | null }
        >()
        for (const a of answersDetail as Array<{
          question_id: number
          override_points: number | null
          points_earned: number | null
        }>) {
          answersByQid.set(a.question_id, {
            override_points: a.override_points,
            points_earned: a.points_earned,
          })
        }
        const sectionQuestionSelections = await resolveSectionQuestionSelectionsForAttempt(
          Number(attemptId),
          Number(quizId),
          sectionConfig,
        )
        const perQuestion = buildPerQuestionEffectivePoints(
          allQuestions.map((q) => ({ max_points: Number(q.max_pts) || 1 })),
          answersByQid,
          allQuestions.map((q) => q.id),
        )
        finalScore = computeSectionWeightedScore(
          allQuestions.map((q) => ({ question_type: q.question_type, id: q.id })),
          perQuestion,
          sectionConfig,
          {
            sectionQuestionSelections,
            answeredQuestionIds: new Set(answersByQid.keys()),
          },
        )
        storedTotalQuestions = 100
      } else {
        // Use actual points earned (decimal values) for flat quizzes
        finalScore = actualPointsEarned
        // CRITICAL: Cap score at total possible points - prevents >100%
        if (['quiz', 'homework', 'final'].includes(quizType) && totalQuizPoints > 0 && actualPointsEarned > totalQuizPoints) {
          console.warn(`[Finalize] Cap: score ${actualPointsEarned} > max ${totalQuizPoints}, capping to ${totalQuizPoints}`)
          finalScore = totalQuizPoints
        }
        storedTotalQuestions = actualTotalQuestionCount

        if (quizType === 'mid_semester' && totalQuizPoints > 0) {
          const percentage = (actualPointsEarned / totalQuizPoints) * 100
          finalScore = Math.round(percentage * 100) / 100
          storedTotalQuestions = 100
        }
      }

      // Update the attempt with final score and details
      // Store as CDT time in timestamp without time zone column
      // Naive timestamp columns store UTC wall-clock; display converts to Central
      // When Neon reads it back, it treats it as UTC, so we get the correct offset
      try {
        // CRITICAL: Check if student_id in quiz_attempts is stored as string (like "DEMO001")
        // If so, we need to handle it differently to avoid trigger errors
        const attemptCheck = await sql`
          SELECT qa.student_id, s.id as student_db_id, s.student_id as student_code
          FROM quiz_attempts qa
          LEFT JOIN students s ON qa.student_id = s.id
          WHERE qa.id = ${attemptId}
          LIMIT 1
        `
        
        const studentIdIsString = attemptCheck.length > 0 && 
                                 typeof attemptCheck[0].student_id === 'string' &&
                                 isNaN(Number(attemptCheck[0].student_id))
        
        // CRITICAL: Temporarily disable trigger to prevent student_id type conversion errors
        // The trigger update_student_learning_profile expects INTEGER but may receive string "DEMO001"
        // This can happen with demo students or if there's data inconsistency
        // Similar to finalize-attempt route, we disable the trigger for all students to be safe
        try {
          await sql`ALTER TABLE quiz_attempts DISABLE TRIGGER trigger_update_profile_after_quiz`
        } catch (triggerError) {
          // If disabling trigger fails (e.g., in serverless DB), log but continue
          console.warn("[Finalize] Could not disable trigger (may not be supported in this DB):", triggerError)
        }
        
        try {
          // Build violation log entry if auto-submitted due to violations or submission stalled (network timeout)
          let violationLogValue = null
          const existingLogResult = await sql`
            SELECT COALESCE(violation_log, '[]'::jsonb) as violation_log
            FROM quiz_attempts
            WHERE id = ${attemptId}
          `
          const existingLog = existingLogResult[0]?.violation_log || []
          const logEntries: Array<{ type: string; reason?: string; timestamp: string; message: string }> = Array.isArray(existingLog)
            ? (existingLog as Array<{ type: string; reason?: string; timestamp: string; message: string }>).filter(
                (e) => e?.type !== "score_pending" && e?.type !== "evaluation_failed"
              )
            : []

          // Check if any answer requires manual review (real content + evaluation issue)
          const requiresReviewResult = await sql`
            SELECT 1 FROM quiz_answers
            WHERE attempt_id = ${attemptId} AND requires_review = true
            LIMIT 1
          `
          if (requiresReviewResult.length > 0) {
            logEntries.push({
              type: "score_pending",
              reason: "evaluation_failed",
              timestamp: new Date().toISOString(),
              message: "One or more questions could not be evaluated automatically. Your score is pending—please wait for an email from your professor."
            })
          }

          if (submissionStalled) {
            logEntries.push({
              type: "submission_stalled",
              reason: "network_timeout",
              timestamp: new Date().toISOString(),
              message: "Submission timed out due to network issues. Student answers and score saved. Flagged for instructor to manually process or re-evaluate."
            })
          }
          if (autoSubmitted && violationReasonValue) {
            logEntries.push({
              type: "auto_submit",
              reason: violationReasonValue,
              timestamp: new Date().toISOString(),
              message: `Assessment automatically submitted due to: ${violationReasonValue}`
            })
          }
          violationLogValue = JSON.stringify(logEntries)

          // Always persist rebuilt violation_log (clears stale score_pending after empty-answer cleanup / recalc)
          const updateResult = await sql`
            UPDATE quiz_attempts
            SET 
              score = ${finalScore},
              total_questions = ${storedTotalQuestions},
              completed_at = NOW(),
              is_final_grade = true,
              violation_log = ${violationLogValue}::jsonb
            WHERE id = ${attemptId}
            RETURNING id, completed_at
          `
          
          // CRITICAL: Verify the update succeeded and completed_at is set
          if (!updateResult || updateResult.length === 0) {
            throw new Error("Failed to update quiz_attempts - no rows affected")
          }
          
          if (!updateResult[0].completed_at) {
            // Retry setting completed_at and is_final_grade
            await sql`
              UPDATE quiz_attempts
              SET completed_at = NOW(), is_final_grade = true
              WHERE id = ${attemptId}
            `
          }
          
          console.log("[Finalize] ✅ Successfully finalized attempt:", {
            attemptId,
            completed_at: updateResult[0].completed_at,
            score: finalScore
          })
          
          // NOTE: Profile update is handled by trigger (if enabled) or skipped for demo students
          // We don't manually call update_student_learning_profile here because:
          // 1. The trigger should handle it automatically (if not disabled)
          // 2. For demo students, the function fails due to string student_id in playground_results
          // 3. Profile updates are non-critical and shouldn't block quiz finalization
        } finally {
          // CRITICAL: Re-enable trigger after update
          try {
            await sql`ALTER TABLE quiz_attempts ENABLE TRIGGER trigger_update_profile_after_quiz`
          } catch (triggerError) {
            // If re-enabling fails, log but don't fail the request
            console.warn("[Finalize] Could not re-enable trigger (non-critical):", triggerError)
          }
        }
      } catch (updateError: any) {
        // CRITICAL: Check if error is due to trigger (student_id type conversion)
        // If so, try to finalize without the trigger
        const isTriggerError = updateError?.message?.includes('invalid input syntax for type integer') ||
                              updateError?.code === '22P02' ||
                              updateError?.message?.includes('DEMO001')
        
        if (isTriggerError) {
          console.warn("[Finalize] ⚠️ Trigger error detected, attempting finalization without trigger...")
          
          try {
            // Try to finalize with trigger disabled (if not already disabled)
            try {
              await sql`ALTER TABLE quiz_attempts DISABLE TRIGGER trigger_update_profile_after_quiz`
            } catch (e) {
              // Trigger might already be disabled or command not supported
            }
            
            // Retry the UPDATE
            const retryResult = await sql`
              UPDATE quiz_attempts
              SET 
                score = ${finalScore},
                total_questions = ${storedTotalQuestions},
                completed_at = NOW(),
                is_final_grade = true
              WHERE id = ${attemptId}
              RETURNING id, completed_at
            `
            
            if (retryResult && retryResult.length > 0 && retryResult[0].completed_at) {
              console.log("[Finalize] ✅ Successfully finalized after trigger error (retry):", {
                attemptId,
                completed_at: retryResult[0].completed_at
              })
              
              // Re-enable trigger
              try {
                await sql`ALTER TABLE quiz_attempts ENABLE TRIGGER trigger_update_profile_after_quiz`
              } catch (e) {
                // Ignore
              }
              
              // Finalization succeeded - continue with rest of function (report generation, etc.)
              // Don't throw - let the function continue normally
            } else {
              // Retry failed - throw the original error
              throw updateError
            }
          } catch (retryError) {
            console.error("[Finalize] ❌ Retry also failed:", retryError)
            // Re-throw original error
            throw updateError
          }
        } else {
          // Not a trigger error - re-throw
          console.error("[Finalize] ❌ CRITICAL: Failed to update quiz_attempts:", updateError)
          throw new Error(`Failed to finalize quiz attempt: ${updateError instanceof Error ? updateError.message : 'Unknown error'}`)
        }
      }
    } catch (calcError) {
      // Never let scoring errors break submission for students
      console.error("[Finalize] Score calculation failed - using safe defaults:", calcError)
      // Keep the default zero values; front-end will still navigate to results
    }

    // Exactly one is_final_grade per student (best/latest/average per retake_policy)
    try {
      const attemptMeta = await sql`
        SELECT student_id FROM quiz_attempts
        WHERE id = ${attemptId} AND deleted_at IS NULL
        LIMIT 1
      `
      const sid = Number(attemptMeta[0]?.student_id)
      if (sid > 0) {
        await reconcileStudentFinalGradeFlags(
          normalizeAssessmentType(quizType) as AssessmentType,
          Number(quizId),
          sid,
        )
      }
    } catch (flagError) {
      console.warn("[Finalize] reconcileStudentFinalGradeFlags (non-fatal):", flagError)
    }

    try {
      const pendingCheck = await sql`
        SELECT violation_log FROM quiz_attempts WHERE id = ${attemptId} LIMIT 1
      `
      const vlog = pendingCheck[0]?.violation_log
      const hasPnd =
        submissionStalled ||
        (Array.isArray(vlog) &&
          vlog.some(
            (e: { type?: string }) =>
              e?.type === "score_pending" || e?.type === "evaluation_failed",
          ))
      if (!hasPnd) {
        await setResultsFinalized(attemptId, true, "submit")
      }
    } catch (finalizeReleaseError) {
      console.warn("[Finalize] setResultsFinalized (non-fatal):", finalizeReleaseError)
    }

    // Return immediately - student gets results page without waiting for non-critical work
    const responsePayload = {
      success: true,
      attemptId,
      score: finalScore,
      correctCount,
      actualPointsEarned: actualPointsEarned,
      totalPossiblePoints: totalQuizPoints,
      totalQuestions,
      answeredCount,
      normalized: quizType === 'mid_semester'
    }

    // Fire-and-forget: report, email, stalled notification - do NOT block the response
    void (async () => {
      try {
        const attemptData = await sql`
          SELECT qa.student_id::INTEGER as student_id, q.course_id::INTEGER as course_id
          FROM quiz_attempts qa
          JOIN quizzes q ON q.id = qa.quiz_id
          WHERE qa.id = ${attemptId}
        `
        const studentId = Number(attemptData[0]?.student_id ?? 0)
        const courseId = attemptData[0]?.course_id != null ? Number(attemptData[0].course_id) : null
        if (studentId > 0) {
          const { recordAssessmentAnalytics } = await import("@/lib/institutions/learning-analytics")
          await recordAssessmentAnalytics({
            studentId,
            attemptId: Number(attemptId),
            quizId: Number(quizId),
            courseId,
            score: finalScore,
            event: "assessment_submitted",
          })
          const aiGraded = await sql`
            SELECT COUNT(*)::int AS n FROM quiz_answers
            WHERE attempt_id = ${attemptId} AND (ai_feedback->>'aiGraded')::boolean IS TRUE
          `
          if (Number(aiGraded[0]?.n ?? 0) > 0) {
            const { recordFeedbackAnalytics } = await import("@/lib/institutions/learning-analytics")
            await recordFeedbackAnalytics({
              studentId,
              attemptId: Number(attemptId),
              quizId: Number(quizId),
              courseId,
              aiGraded: true,
            })
          }
        }
      } catch {
        /* non-blocking */
      }
      try {
        const attemptData = await sql`
          SELECT student_id::INTEGER as student_id FROM quiz_attempts WHERE id = ${attemptId}
        `
        if (attemptData[0]?.student_id) {
          const studentIdInt = parseInt(String(attemptData[0].student_id))
          if (!isNaN(studentIdInt)) {
            const reportData = await sql`
              SELECT generate_quiz_report(${attemptId}) as report
            `.catch(async (error) => {
              // Avoid critical system logs when report generation times out on heavy attempts
              const err = error as { message?: string }
              if (err?.message?.includes("timeout") || err?.message?.includes("Timeout")) {
                console.warn("[Finalize] generate_quiz_report timed out (non-fatal):", err.message)
                return []
              }
              throw error
            })
            if (reportData[0]?.report) {
              await sql`
                SELECT save_learning_report(
                  ${studentIdInt}::INTEGER,
                  ${(quizType || 'quiz')}::VARCHAR,
                  ${attemptId}::INTEGER,
                  ${reportData[0].report}::JSONB
                )
              `
            }
          }
        }
      } catch (e) {
        console.warn("[Finalize] Report generation (background):", e)
      }
      try {
        const attemptInfo = await sql`
          SELECT qa.student_id, q.title, q.assessment_type
          FROM quiz_attempts qa
          JOIN quizzes q ON q.id = qa.quiz_id
          WHERE qa.id = ${attemptId}
        `
        if (attemptInfo[0]?.student_id && attemptInfo[0]?.title) {
          const { getStudentForEmail } = await import("@/lib/email/send-notification-email")
          const { sendEmail } = await import("@/lib/email/sendEmail")
          const student = await getStudentForEmail(Number(attemptInfo[0].student_id))
          const assessmentType = (attemptInfo[0].assessment_type as string) || "quiz"
          const typeMap: Record<string, string> = {
            quiz: "quiz", homework: "homework", mid_semester: "mid-semester", final: "final",
          }
          const scorePct = totalQuizPoints > 0
            ? Math.round((actualPointsEarned / totalQuizPoints) * 100)
            : 0
          const reportLink = `/student/results/${attemptId}`

          await createNotification({
            studentId: Number(attemptInfo[0].student_id),
            type: "grade",
            title: `Graded: ${attemptInfo[0].title}`,
            message: `Your ${typeMap[assessmentType] || "assessment"} was graded — ${scorePct}% (${actualPointsEarned}/${totalQuizPoints} pts).`,
            link: reportLink,
          }).catch((e) => console.warn("[Finalize] Grade notification (background):", e))

          if (student?.email) {
            await sendEmail("assessment_completed", student.email, {
              name: student.name,
              assessmentType: typeMap[assessmentType] || "quiz",
              assessmentTitle: attemptInfo[0].title as string,
              score: String(actualPointsEarned),
              maxScore: String(totalQuizPoints),
              link: (process.env.NEXT_PUBLIC_BASE_URL || "https://course-collab.com") + reportLink,
            }).catch((e) => console.warn("[Finalize] Email (background):", e))
          }
        }
      } catch (e) {
        console.warn("[Finalize] Email (background):", e)
      }
      if (submissionStalled) {
        try {
          const [info] = await sql`
            SELECT s.full_name, s.email, q.title as quiz_title
            FROM quiz_attempts qa
            JOIN students s ON qa.student_id = s.id
            JOIN quizzes q ON qa.quiz_id = q.id
            WHERE qa.id = ${attemptId}
          `
          if (info?.full_name && info?.quiz_title) {
            await sql`
              INSERT INTO quiz_issues (
                quiz_id, assessment_id, assessment_type, quiz_title, question_number,
                description, reporter_name, reporter_id, issue_type, status
              )
              VALUES (
                ${quizId}, ${quizId}, ${quizType || 'quiz'}, ${info.quiz_title}, NULL,
                ${`[System] Submission stalled: Network timeout during finalization. Student "${info.full_name}" completed the quiz and answers were saved. Attempt ID: ${attemptId}. Please verify this attempt appears in results.`},
                ${info.full_name}, ${String(info.email || info.full_name)}, 'issue', 'open'
              )
            `
            await createInstructorNotification({
              type: "submission_stalled",
              title: "Submission Issue - Student Needs Review",
              message: `Student "${info.full_name}" had a network timeout during quiz submission. Their answers were saved. Attempt ID: ${attemptId}. Check the Flagged results.`,
              link: `/instructor/results/${attemptId}`,
              source_type: "quiz_attempt",
              source_id: String(attemptId),
            }).catch(() => {})
          }
        } catch (e) {
          console.warn("[Finalize] Stalled notification (background):", e)
        }
      }
    })()

    return NextResponse.json(responsePayload)
  } catch (error) {
    console.error("[Finalize] ERROR:", error)
    if (error instanceof Error) {
      console.error("[Finalize] Error details:", {
        message: error.message,
        stack: error.stack
      })
    }
    return NextResponse.json({ 
      error: "Failed to finalize quiz",
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
