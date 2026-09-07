import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { normalizeAssessmentType } from "@/lib/assessment-core/db"
import { reconcileStudentFinalGradeFlags } from "@/lib/assessment-core/submit"
import {
  assessmentUsesSectionWeightedGrade,
  type SectionConfig,
} from "@/lib/assessment-sections"
import {
  capQuestionPoints,
  computeSectionWeightedScore,
} from "@/lib/section-weighted-attempt-score"

// Use Node runtime for quiz finalization (database-heavy operation)
export const dynamic = 'force-dynamic'
export const runtime = "nodejs"
export const maxDuration = 30 // 30 second max duration for heavy operations

export async function POST(request: NextRequest) {
  try {
    const { attemptId, autoSubmitted, violationReason } = await request.json()

    if (!attemptId) {
      return NextResponse.json({ error: "Missing attemptId" }, { status: 400 })
    }

    // CRITICAL: Ensure attemptId is an integer for database queries
    const attemptIdInt = Number.parseInt(String(attemptId), 10)
    if (isNaN(attemptIdInt)) {
      return NextResponse.json({ error: "Invalid attemptId format" }, { status: 400 })
    }

    // Get quiz attempt details to determine assessment type and student_id
    const attemptResult = await sql`
      SELECT 
        qa.quiz_id,
        qa.student_id,
        q.assessment_type
      FROM quiz_attempts qa
      JOIN quizzes q ON qa.quiz_id = q.id
      WHERE qa.id = ${attemptIdInt}
    `

    if (attemptResult.length === 0) {
      return NextResponse.json({ error: "Attempt not found" }, { status: 404 })
    }

    const quizId = attemptResult[0].quiz_id
    const studentId = attemptResult[0].student_id
    const assessmentType = attemptResult[0].assessment_type

    // Check student_id type - log warning if invalid but don't block finalization yet
    // We'll handle it gracefully by disabling the trigger
    const studentIdCheck = await sql`
      SELECT student_id FROM quiz_attempts WHERE id = ${attemptIdInt}
    `
    const studentIdFromAttempt = studentIdCheck?.[0]?.student_id
    const hasInvalidStudentId = !Number.isInteger(studentIdFromAttempt)

    // Normalize assessment type for report path
    const typeMap: Record<string, string> = {
      'quiz': 'quiz',
      'homework': 'homework',
      'mid_semester': 'midsem',
      'midsem': 'midsem',
      'final': 'final',
      'practice': 'practice'
    }
    const normalizedType = typeMap[assessmentType] || 'quiz'

    // Fetch section_config and assessment_type for section-weighted scoring when configured.
    const quizConfigResult = await sql`
      SELECT section_config, assessment_type FROM quizzes WHERE id = ${quizId}
    `
    const sectionConfig = quizConfigResult[0]?.section_config as SectionConfig[] | null | undefined
    const quizAssessmentType = quizConfigResult[0]?.assessment_type ?? assessmentType ?? "quiz"
    const useSectionWeighting = assessmentUsesSectionWeightedGrade(
      quizAssessmentType,
      sectionConfig,
    )

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

    const answersResult = await sql`
      WITH latest_per_question AS (
        SELECT DISTINCT ON (qa.question_id)
          qa.question_id,
          qa.override_points,
          qa.points_earned,
          qa.is_correct,
          COALESCE(qq.max_points, qq.points, 1) as max_pts
        FROM quiz_answers qa
        INNER JOIN quiz_questions qq ON qq.id = qa.question_id AND qq.quiz_id = ${quizId}
        WHERE qa.attempt_id = ${attemptIdInt}
        ORDER BY qa.question_id, qa.id DESC
      )
      SELECT * FROM latest_per_question
    `
    const answersByQid = new Map<
      number,
      {
        override_points: number | null
        points_earned: number | null
        is_correct: boolean
        max_pts: number
      }
    >()
    for (const a of answersResult as Array<{
      question_id: number
      override_points: number | null
      points_earned: number | null
      is_correct: boolean
      max_pts: number
    }>) {
      answersByQid.set(a.question_id, {
        override_points: a.override_points,
        points_earned: a.points_earned,
        is_correct: a.is_correct,
        max_pts: Number(a.max_pts) || 1,
      })
    }

    let actualScore: number
    let totalQuestions: number

    if (useSectionWeighting) {
      const perQuestion = allQuestions.map((q) => {
        const ans = answersByQid.get(q.id)
        const max = Number(q.max_pts) || 1
        const effective = ans
          ? capQuestionPoints(ans.override_points, ans.points_earned, max)
          : 0
        return { max_points: max, effective_points: effective }
      })
      actualScore = computeSectionWeightedScore(
        allQuestions.map((q) => ({ question_type: q.question_type })),
        perQuestion,
        sectionConfig,
      )
      totalQuestions = 100
    } else {
      const scoreResult = await sql`
        WITH latest_per_question AS (
          SELECT DISTINCT ON (qa.question_id)
            qa.id, qa.points_earned, qa.is_correct,
            COALESCE(qq.max_points, qq.points, 1) as max_pts
          FROM quiz_answers qa
          JOIN quiz_questions qq ON qa.question_id = qq.id
          WHERE qa.attempt_id = ${attemptIdInt}
          ORDER BY qa.question_id, qa.id DESC
        )
        SELECT 
          COALESCE(SUM(
            COALESCE(l.points_earned, CASE WHEN l.is_correct = true THEN l.max_pts ELSE 0 END, 0)
          ), 0) as actual_points_earned,
          COUNT(l.id) as answered_count
        FROM latest_per_question l
      `
      const totalQuestionsResult = await sql`
        SELECT COUNT(*) as total_questions FROM quiz_questions WHERE quiz_id = ${quizId}
      `
      actualScore = Number(scoreResult[0]?.actual_points_earned) || 0
      totalQuestions = Number(totalQuestionsResult[0]?.total_questions) || 0

      const totalQuizPoints = allQuestions.reduce((sum, q) => sum + Number(q.max_pts), 0)
      if (totalQuizPoints > 0 && actualScore > totalQuizPoints) {
        console.warn(`[FinalizeAttempt] Cap: score ${actualScore} > max ${totalQuizPoints}, capping`)
        actualScore = totalQuizPoints
      }
    }

    // Update quiz attempt - finalize with violation info and calculated scores
    let violationLogValue: any = null
    if (autoSubmitted && violationReason) {
      // Get existing violation_log or initialize as empty array
      const existingLogResult = await sql`
        SELECT COALESCE(violation_log, '[]'::jsonb) as violation_log
        FROM quiz_attempts
        WHERE id = ${attemptIdInt}
      `
      const existingLog = existingLogResult[0]?.violation_log || []
      
      // Add auto-submission entry
      const autoSubmitEntry = {
        type: "auto_submit",
        reason: violationReason,
        timestamp: new Date().toISOString(),
        message: `Assessment automatically submitted due to: ${violationReason}`
      }
      
      violationLogValue = [...(Array.isArray(existingLog) ? existingLog : []), autoSubmitEntry]
    }

    // Finalize the attempt with calculated scores
    // Note: completed_at indicates the attempt is finalized
    // CRITICAL: Temporarily disable trigger to prevent student_id type conversion errors
    console.log("[FINALIZE-ATTEMPT] 🔄 Attempting to UPDATE quiz_attempts", {
      attemptId: attemptIdInt,
      actualScore,
      totalQuestions,
      autoSubmitted,
      violationReason,
      hasViolationLog: violationLogValue !== null,
      timestamp: new Date().toISOString()
    })
    
    try {
      // CRITICAL: Temporarily disable the trigger to prevent student_id type conversion errors
      // The trigger update_student_learning_profile expects INTEGER but may receive string "DEMO001"
      await sql`ALTER TABLE quiz_attempts DISABLE TRIGGER trigger_update_profile_after_quiz`
      
      try {
        // Step 1: Update completed_at first (most critical - marks attempt as finalized)
        await sql`
          UPDATE quiz_attempts
          SET completed_at = NOW()
          WHERE id = ${attemptIdInt}
        `
        
        // Step 2: Update other fields (score, auto_submitted, etc.)
        let updateResult
        if (violationLogValue !== null) {
          updateResult = await sql`
            UPDATE quiz_attempts
            SET
              score = ${actualScore},
              total_questions = ${totalQuestions},
              is_final_grade = true,
              auto_submitted = ${autoSubmitted || false},
              violation_reason = ${violationReason || null},
              violation_log = ${JSON.stringify(violationLogValue)}::jsonb
            WHERE id = ${attemptIdInt}
            RETURNING id, completed_at, auto_submitted, violation_reason
          `
        } else {
          updateResult = await sql`
            UPDATE quiz_attempts
            SET
              score = ${actualScore},
              total_questions = ${totalQuestions},
              is_final_grade = true,
              auto_submitted = ${autoSubmitted || false},
              violation_reason = ${violationReason || null}
            WHERE id = ${attemptIdInt}
            RETURNING id, completed_at, auto_submitted, violation_reason
          `
        }
        
        console.log("[FINALIZE-ATTEMPT] ✅ Step 2: Other fields updated", {
          attemptId: attemptIdInt,
          updateResult: updateResult?.[0] ? {
            id: updateResult[0].id,
            completed_at: updateResult[0].completed_at,
            auto_submitted: updateResult[0].auto_submitted,
            violation_reason: updateResult[0].violation_reason
          } : null,
          timestamp: new Date().toISOString()
        })
        
        // Step 3: Manually trigger profile update AFTER successful finalization
        // Get student_id from attempt to ensure it's an integer
        const studentIdResult = await sql`
          SELECT student_id FROM quiz_attempts WHERE id = ${attemptIdInt}
        `
        const numericStudentId = Number(studentIdResult[0]?.student_id)
        
        if (!isNaN(numericStudentId) && numericStudentId > 0) {
          try {
            await sql`SELECT update_student_learning_profile(${numericStudentId})`
          } catch (profileError: any) {
            // Non-critical - don't fail finalization
          }
        }
      } finally {
        // CRITICAL: Re-enable trigger after UPDATE completes
        await sql`ALTER TABLE quiz_attempts ENABLE TRIGGER trigger_update_profile_after_quiz`
      }
    } catch (triggerError: any) {
      // If disabling trigger fails, log but continue with update attempt
      console.warn("[FINALIZE-ATTEMPT] ⚠️ Failed to disable trigger (non-critical)", {
        error: triggerError.message,
        attemptId: attemptIdInt,
        timestamp: new Date().toISOString()
      })
      // Continue with normal update - trigger might still work if it was fixed
    }
    
    // CRITICAL: Verify the update actually worked by querying the attempt
    const verificationResult = await sql`
      SELECT id, completed_at, auto_submitted, violation_reason, score, total_questions
      FROM quiz_attempts
      WHERE id = ${attemptIdInt}
    `
    
    const verification = verificationResult?.[0]
    const isActuallyFinalized = verification?.completed_at !== null
    
    // CRITICAL: If UPDATE failed, try one more time with a different approach
    // Use raw SQL to bypass trigger if possible, or update fields individually
    if (!isActuallyFinalized) {
      console.error("[FINALIZE-ATTEMPT] ❌ UPDATE FAILED - Attempt NOT finalized in database!", {
        attemptId: attemptIdInt,
        verification,
        timestamp: new Date().toISOString()
      })
      
      // Last resort: Try updating completed_at using a direct SQL approach that might bypass trigger
      try {
        // Get student_id from the attempt to check its type
        const attemptCheck = await sql`
          SELECT student_id FROM quiz_attempts WHERE id = ${attemptIdInt}
        `
        const studentIdFromAttempt = attemptCheck?.[0]?.student_id
        
        console.log("[FINALIZE-ATTEMPT] 🔄 Last resort UPDATE attempt", {
          attemptId: attemptIdInt,
          studentIdFromAttempt,
          studentIdType: typeof studentIdFromAttempt,
          timestamp: new Date().toISOString()
        })
        
        // Try updating with explicit type handling
        await sql`
          UPDATE quiz_attempts
          SET
            completed_at = NOW(),
            score = ${actualScore},
            total_questions = ${totalQuestions},
            is_final_grade = true,
            auto_submitted = ${autoSubmitted || false},
            violation_reason = ${violationReason || null}
          WHERE id = ${attemptIdInt}
        `
        
        // Verify again
        const finalCheck = await sql`
          SELECT completed_at, auto_submitted, violation_reason
          FROM quiz_attempts
          WHERE id = ${attemptIdInt}
        `
        
        const finalCompletedAt = finalCheck?.[0]?.completed_at
        
        // CRITICAL: If still not finalized, check student_id type - this is the root cause
        if (!finalCompletedAt) {
          const studentIdCheck = await sql`
            SELECT student_id FROM quiz_attempts WHERE id = ${attemptIdInt}
          `
          const problematicStudentId = studentIdCheck?.[0]?.student_id
          
          // HARD STOP: Throw error if finalization failed
          throw new Error(
            `Attempt finalization failed — completed_at still NULL. ` +
            `This is likely due to invalid student_id type (${typeof problematicStudentId}: ${problematicStudentId}). ` +
            `quiz_attempts.student_id must be INTEGER, not string.`
          )
        }
      } catch (lastResortError: any) {
        console.error("[FINALIZE-ATTEMPT] ❌ Last resort UPDATE also failed", {
          error: lastResortError.message,
          attemptId: attemptIdInt,
          timestamp: new Date().toISOString()
        })
        // HARD STOP: Re-throw to prevent silent failure
        throw lastResortError
      }
    }
    
    // CRITICAL: Final verification - if still not finalized, throw error
    const finalVerification = await sql`
      SELECT completed_at FROM quiz_attempts WHERE id = ${attemptIdInt}
    `
    const isFinalized = finalVerification?.[0]?.completed_at !== null
    
    if (!isFinalized) {
      const studentIdCheck = await sql`
        SELECT student_id FROM quiz_attempts WHERE id = ${attemptIdInt}
      `
      const problematicStudentId = studentIdCheck?.[0]?.student_id
      
      throw new Error(
        `Attempt finalization FAILED — completed_at is still NULL after all update attempts. ` +
        `Root cause: student_id type issue (${typeof problematicStudentId}: ${problematicStudentId}). ` +
        `quiz_attempts.student_id must be INTEGER. This attempt cannot be finalized.`
      )
    }

    // Exactly one is_final_grade per student (best/latest/average per retake_policy)
    try {
      await reconcileStudentFinalGradeFlags(
        normalizeAssessmentType(assessmentType),
        Number(quizId),
        Number(studentId),
      )
    } catch (flagError) {
      console.warn("[FINALIZE-ATTEMPT] reconcileStudentFinalGradeFlags (non-fatal):", flagError)
    }

    // Build report path
    const reportPath =
      normalizedType === "final"
        ? `/student/results/${attemptId}`
        : `/student/${normalizedType}/report/${attemptId}`

    // CRITICAL: Delete ALL incomplete attempts for this student/quiz immediately after finalization
    // Incomplete attempts are not needed - only completed attempts should exist
    // This ensures cleanup happens as soon as the quiz is over, not when instructor views results
    const deletedIncomplete = await sql`
      DELETE FROM quiz_attempts
      WHERE student_id = ${studentId}
        AND quiz_id = ${quizId}
        AND deleted_at IS NULL
        AND completed_at IS NULL
        AND id != ${attemptIdInt}
      RETURNING id
    `
    
    if (deletedIncomplete.length > 0) {
      console.log("[FINALIZE-ATTEMPT] 🧹 Deleted incomplete attempts after finalization", {
        attemptId: attemptIdInt,
        studentId,
        quizId,
        deletedCount: deletedIncomplete.length,
        deletedIds: deletedIncomplete.map((a: any) => a.id),
        timestamp: new Date().toISOString()
      })
    }

    console.log("[FINALIZE-ATTEMPT] ✅ Finalization complete", {
      attemptId,
      reportPath,
      score: actualScore,
      answeredCount,
      totalQuestions,
      autoSubmitted,
      violationReason,
      timestamp: new Date().toISOString(),
      stackTrace: new Error().stack?.split('\n').slice(0, 10).join('\n')
    })

    return NextResponse.json({
      success: true,
      reportPath
    })

  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to finalize attempt" },
      { status: 500 }
    )
  }
}
