import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import {
  groupQuestionsBySections,
  calculateWeightedScore,
  assessmentUsesSectionWeightedGrade,
  parseAssessmentSectionConfig,
  type SectionConfig,
} from "@/lib/assessment-sections"
import { computeSectionScoreRows } from "@/lib/section-weighted-attempt-score"
import { resolveSectionQuestionSelectionsForAttempt } from "@/lib/load-section-question-selections"
import { getDocumentAtTime, type TypingReplay } from "@/lib/typing-replay"
import { resolveCodeDisplayWithTypingReplay } from "@/lib/code-typing-consistency"
import { isCodeAnswerCorrupt } from "@/lib/code-answer-validation"
import { deriveViolationLogAndShouldShowPnd } from "@/lib/results-pnd"
import { isMidSemesterOverrideType } from "@/lib/instructor-score-override"
import { requireAttemptOwnership } from "@/lib/student-api-auth"
import {
  QUIZ_QUESTION_BANK_SELECT,
  quizQuestionBankJoin,
  resolveQuizQuestionsFromBank,
} from "@/lib/resolve-quiz-question-from-bank"
import { ensureResultsFinalizedColumns } from "@/lib/ensure-results-finalized-columns"
import { resultsFinalizedFieldsFromAttempt } from "@/lib/results-finalized"

export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const attemptId = id

    if (request.headers.get("x-instructor-id")?.trim()) {
      const { requireInstructorAttemptAccess } = await import("@/lib/instructor-results-auth")
      const access = await requireInstructorAttemptAccess(request, attemptId)
      if (!access.ok) return access.response
    } else {
      const ownership = await requireAttemptOwnership(request, parseInt(attemptId, 10))
      if (!ownership.ok) return ownership.response
    }

    await ensureResultsFinalizedColumns()

    // CRITICAL: Handle invalid student_id gracefully
    // If student_id is not an integer, the JOIN will fail
    // Try with JOIN first, if it fails, try without JOIN and look up student separately
    let attemptResult
    try {
      attemptResult = await sql`
        SELECT 
          qa.id,
          qa.quiz_id,
          qa.student_id,
          qa.score,
          qa.total_score_override,
          qa.total_questions,
          qa.started_at,
          qa.completed_at,
          qa.saved_for_later_at,
          qa.deleted_at,
          q.title as quiz_title,
          q.assessment_type,
          q.section_config,
          COALESCE(q.lock_student_results_review, false) as lock_student_results_review,
          s.full_name as student_name,
          s.student_id,
          s.section,
          COALESCE(qa.tab_switch_count, 0) as tab_switch_count,
          COALESCE(qa.copy_paste_attempts, 0) as copy_paste_attempts,
          COALESCE(qa.mouse_leave_count, 0) as mouse_leave_count,
          COALESCE(qa.gemini_strikes_count, 0) as gemini_strikes_count,
          COALESCE(qa.violation_log, '[]'::jsonb) as violation_log,
          COALESCE(qa.auto_submitted, false) as auto_submitted,
          qa.violation_reason,
          qa.pdf_downloaded_at,
          qa.student_bulk_re_evaluate_used_at,
          qa.results_finalized_at,
          qa.results_finalized_by
        FROM quiz_attempts qa
        JOIN quizzes q ON qa.quiz_id = q.id
        JOIN students s ON qa.student_id = s.id
        WHERE qa.id = ${attemptId}
          AND qa.deleted_at IS NULL
      `
    } catch (joinError: any) {
      // If JOIN fails (likely due to invalid student_id type), try without JOIN
      console.warn("[Results API] JOIN failed, trying alternative query", {
        attemptId,
        error: joinError.message
      })
      
      const attemptOnly = await sql`
        SELECT 
          qa.id,
          qa.quiz_id,
          qa.student_id,
          qa.score,
          qa.total_score_override,
          qa.total_questions,
          qa.started_at,
          qa.completed_at,
          qa.saved_for_later_at,
          qa.deleted_at,
          COALESCE(qa.tab_switch_count, 0) as tab_switch_count,
          COALESCE(qa.copy_paste_attempts, 0) as copy_paste_attempts,
          COALESCE(qa.mouse_leave_count, 0) as mouse_leave_count,
          COALESCE(qa.gemini_strikes_count, 0) as gemini_strikes_count,
          COALESCE(qa.violation_log, '[]'::jsonb) as violation_log,
          COALESCE(qa.auto_submitted, false) as auto_submitted,
          qa.violation_reason,
          qa.student_bulk_re_evaluate_used_at
        FROM quiz_attempts qa
        WHERE qa.id = ${attemptId}
          AND qa.deleted_at IS NULL
      `
      
      if (attemptOnly.length === 0) {
        console.error("[Results API] Attempt not found:", attemptId)
        return NextResponse.json({ error: "Quiz attempt not found. Please complete the quiz first." }, { status: 404 })
      }
      
      const quizInfo = await sql`
        SELECT title, assessment_type, section_config,
          COALESCE(lock_student_results_review, false) as lock_student_results_review
        FROM quizzes
        WHERE id = ${attemptOnly[0].quiz_id}
      `
      
      // Try to get student info if student_id is numeric
      let studentInfo: any = { full_name: "Unknown Student", student_id: "N/A", section: "N/A" }
      if (Number.isInteger(attemptOnly[0].student_id)) {
        try {
          const studentData = await sql`
            SELECT full_name, student_id, section
            FROM students
            WHERE id = ${attemptOnly[0].student_id}
          `
          if (studentData.length > 0) {
            studentInfo = studentData[0]
          }
        } catch (studentError) {
          console.warn("[Results API] Failed to fetch student info", { studentId: attemptOnly[0].student_id })
        }
      }
      
      attemptResult = [{
        ...attemptOnly[0],
        quiz_title: quizInfo[0]?.title || "Unknown Quiz",
        assessment_type: quizInfo[0]?.assessment_type || "quiz",
        section_config: quizInfo[0]?.section_config ?? null,
        lock_student_results_review: quizInfo[0]?.lock_student_results_review === true,
        student_name: studentInfo.full_name,
        student_id: studentInfo.student_id,
        section: studentInfo.section
      }]
    }

    if (attemptResult.length === 0) {
      console.error("[Results API] Attempt not found:", attemptId)
      return NextResponse.json({ error: "Quiz attempt not found. Please complete the quiz first." }, { status: 404 })
    }

    const attempt = attemptResult[0]
    const attemptIdNum = parseInt(String(attemptId), 10)

    // Load questions for this quiz only; attach answers by position so we never lose data when question IDs were replaced.
    let questions = await sql`
      SELECT
        q.id,
        q.id as question_id,
        q.bank_question_id,
        q.question_order,
        q.question_text,
        q.question_type,
        q.time_limit,
        q.option_a,
        q.option_b,
        q.option_c,
        q.option_d,
        q.option_e,
        q.correct_answer,
        q.sample_answers,
        q.subquestions,
        q.solution_upload_config,
        q.question_media,
        q.circuit_spec,
        COALESCE(q.max_points, q.points, 1) as max_points,
        COALESCE(q.points, 1) as points,
        NULL::int as answer_id,
        NULL::text as selected_answer,
        NULL::jsonb as answer_data,
        false as is_correct,
        NULL::jsonb as ai_feedback,
        0::numeric as points_earned,
        NULL::numeric as override_points,
        NULL::text as reviewed_by,
        NULL::timestamptz as reviewed_at,
        NULL::text as override_comment,
        ${sql.unsafe(QUIZ_QUESTION_BANK_SELECT)}
      FROM quiz_questions q
      ${sql.unsafe(quizQuestionBankJoin("q"))}
      WHERE q.quiz_id = ${attempt.quiz_id}
      ORDER BY q.question_order ASC NULLS LAST, q.id ASC
    `
    questions = resolveQuizQuestionsFromBank(questions as Record<string, unknown>[]).map((q) => ({
      ...q,
      question_id: q.id ?? q.question_id,
    }))

    const answersForAttempt = await sql`
      SELECT qa.id as answer_id, qa.question_id, qa.selected_answer, qa.answer_data,
             qa.points_earned, qa.override_points, qa.is_correct, qa.ai_feedback, qa.requires_review, qa.time_spent_seconds,
             qa.student_re_evaluate_used_at, qa.reviewed_by, qa.reviewed_at,
             qq.question_order
      FROM quiz_answers qa
      LEFT JOIN quiz_questions qq ON qq.id = qa.question_id AND qq.quiz_id = ${attempt.quiz_id}
      WHERE qa.attempt_id = ${attemptIdNum}
      ORDER BY COALESCE(qq.question_order, 999), qa.question_id, qa.id
    `

    const qList = questions as any[]
    const aList = answersForAttempt as any[]
    qList.sort((a, b) => (Number(a?.question_order) ?? 999) - (Number(b?.question_order) ?? 999))

    // Match answers to questions: prefer question_id match (correct when questions unchanged),
    // then fall back to position for orphaned answers (when question was replaced/deleted).
    // Use String keys to avoid number/string type mismatches from DB drivers.
    const questionIds = new Set(qList.map((q: any) => String(q?.question_id ?? '')))
    const byQuestionId = new Map<string, any>()
    const orphaned: any[] = []
    for (const a of aList) {
      const qid = a.question_id != null ? String(a.question_id) : ''
      if (qid && questionIds.has(qid)) {
        byQuestionId.set(qid, a)
      } else {
        orphaned.push(a)
      }
    }
    orphaned.sort((x, y) => (Number(x?.question_order) ?? 999) - (Number(y?.question_order) ?? 999) || (Number(x?.question_id) ?? 0) - (Number(y?.question_id) ?? 0) || (Number(x?.answer_id) ?? 0) - (Number(y?.answer_id) ?? 0))
    let orphanIdx = 0
    for (const q of qList) {
      if (!q) continue
      const qid = q.question_id != null ? String(q.question_id) : ''
      let a = qid ? byQuestionId.get(qid) : null
      if (!a && orphanIdx < orphaned.length) {
        a = orphaned[orphanIdx++]
      }
      if (a) {
        q.answer_id = a.answer_id
        q.answer_data = a.answer_data
        // Use override_points when instructor manually overrode; else points_earned (from re-evaluation or auto-grade)
        const effectivePoints = a.override_points != null ? Number(a.override_points) : (a.points_earned != null ? Number(a.points_earned) : 0)
        q.points_earned = effectivePoints
        q.is_correct = a.is_correct === true
        q.ai_feedback = a.ai_feedback
        q.requires_review = a.requires_review === true
        q.student_re_evaluate_used_at = a.student_re_evaluate_used_at
        if (a.reviewed_by != null) q.reviewed_by = a.reviewed_by
        if (a.reviewed_at != null) q.reviewed_at = a.reviewed_at
        if (a.override_points != null) q.override_points = a.override_points
        const rawTime = a.time_spent_seconds != null ? Number(a.time_spent_seconds) : null
        const timeLimit = q.time_limit != null ? Number(q.time_limit) : null
        q.time_spent_seconds = rawTime != null
          ? (timeLimit != null && timeLimit > 0 && rawTime > timeLimit ? timeLimit : rawTime)
          : null
        // Extract selected_answer/code: for code questions prefer answer_data.code, then answer_data.answer, then selected_answer
        // RECOVERY: If stored value looks corrupt (single letter, very short) but we have typing_replay, derive from replay
        const qtLower = (q as any).question_type?.toLowerCase()
        const isCodeQ = ['code_write', 'code_problem', 'debug_code', 'code_explain', 'code_write_plot', 'code_debug'].includes(qtLower)
        const isMultiPartQ = qtLower === 'multi_part'
        let extracted = a.selected_answer != null && String(a.selected_answer).trim() !== '' ? a.selected_answer : null
        let parsedAd: { code?: string; answer?: unknown; typing_replay?: { events?: Array<{ t: number }> } } | null = null
        if (a.answer_data) {
          try {
            parsedAd = typeof a.answer_data === 'string' ? JSON.parse(a.answer_data) : a.answer_data
            if (parsedAd && typeof parsedAd === 'object') {
              if (isMultiPartQ && extracted == null) {
                if (parsedAd.parts || parsedAd.solution_uploads || parsedAd.version === 1) {
                  extracted = typeof a.answer_data === 'string' ? a.answer_data : JSON.stringify(parsedAd)
                }
              } else if (isCodeQ && parsedAd.code && String(parsedAd.code).trim()) {
                extracted = typeof parsedAd.code === 'string' ? parsedAd.code : JSON.stringify(parsedAd.code)
              } else if (extracted == null && parsedAd.answer != null) {
                extracted = typeof parsedAd.answer === 'string' ? parsedAd.answer : JSON.stringify(parsedAd.answer)
              }
            }
          } catch {
            /* ignore */
          }
        }
        // RECOVERY: Stored code is corrupt but typing_replay has full code
        const looksCorrupt = isCodeQ && extracted && isCodeAnswerCorrupt(extracted)
        if (looksCorrupt && parsedAd?.typing_replay?.events?.length) {
          const lastT = Math.max(...parsedAd.typing_replay.events.map((e: { t: number }) => e.t), 0)
          const derived = getDocumentAtTime(parsedAd.typing_replay as any, lastT + 1000)
          if (derived?.trim() && derived.length > (extracted?.length || 0)) {
            extracted = derived
          }
        }
        // Never show corrupt MCQ garbage for code questions when we can't recover
        if (looksCorrupt && !parsedAd?.typing_replay?.events?.length) {
          extracted = null
        }
        q.selected_answer = extracted
      }
    }

    // Normalize selected_answer: ensure it's a displayable string (from answer_data.answer or avoid [object Object])
    questions = questions.map(q => {
      const isMultiPartQ = (q as any).question_type?.toLowerCase() === 'multi_part'
      let val = q.selected_answer
      if (val != null && typeof val === 'object') {
        val = (val as Record<string, unknown>).answer != null
          ? (typeof (val as Record<string, unknown>).answer === 'string' ? (val as Record<string, unknown>).answer : JSON.stringify((val as Record<string, unknown>).answer))
          : JSON.stringify(val)
      } else if (val != null) {
        val = String(val).trim() || null
      }
      const rawAnswerData = q.answer_data
      if ((val === null || val === '') && rawAnswerData) {
        try {
          const ad = typeof rawAnswerData === 'string' ? JSON.parse(rawAnswerData) : rawAnswerData
          if (isMultiPartQ && ad && typeof ad === 'object' && (ad.parts || ad.solution_uploads || ad.version === 1)) {
            val = typeof rawAnswerData === 'string' ? rawAnswerData : JSON.stringify(ad)
          } else if (ad && typeof ad === 'object' && ad.answer !== undefined && ad.answer !== null) {
            val = typeof ad.answer === 'string' ? ad.answer : JSON.stringify(ad.answer)
          }
        } catch {
          // ignore
        }
      }
      q.selected_answer = val ?? null
      return q
    })

    // Parse ai_feedback and answer_data if they're JSON strings
    questions = questions.map(q => {
      if (q.ai_feedback && typeof q.ai_feedback === 'string') {
        try {
          const parsed = JSON.parse(q.ai_feedback)
          // Ensure all feedback fields are preserved
          q.ai_feedback = {
            ...parsed,
            // Ensure critical fields exist
            score: parsed.score !== undefined ? parsed.score : null,
            feedback: parsed.feedback || parsed.studentMessage || null,
            requiresManualReview: parsed.requiresManualReview || parsed.errorType ? true : false,
            aiGraded: parsed.aiGraded !== undefined ? parsed.aiGraded : true,
            status: parsed.status || null,
            statusMessage: parsed.statusMessage || null,
            errorType: parsed.errorType || null,
            // Preserve all other fields
            ...Object.keys(parsed).reduce((acc, key) => {
              if (!['score', 'feedback', 'requiresManualReview', 'aiGraded', 'status', 'statusMessage', 'errorType'].includes(key)) {
                acc[key] = parsed[key]
              }
              return acc
            }, {} as any)
          }
        } catch (e) {
          console.error('[v0] Failed to parse ai_feedback:', e, 'Raw value:', q.ai_feedback?.substring(0, 100))
          // If parsing fails, create a basic structure
          q.ai_feedback = {
            feedback: q.ai_feedback,
            requiresManualReview: true,
            aiGraded: false,
            status: "Manual Review Required",
            statusMessage: "Unable to parse AI feedback. Instructor review required."
          }
        }
      }
      
      // Parse answer_data for code questions to extract code and plot images
      const isCodeQuestion = ['code_write', 'code_problem', 'debug_code', 'code_explain', 'code_write_plot', 'code_debug'].includes(q.question_type?.toLowerCase())
      
      if (q.answer_data && isCodeQuestion) {
        try {
          const parsed = typeof q.answer_data === 'string' ? JSON.parse(q.answer_data) : q.answer_data
          // Extract code from JSON structure
          if (parsed?.code) {
            q.code = parsed.code
          } else if (parsed?.answer) {
            q.code = parsed.answer
          }
          // Extract plot image for code_write_plot
          if (parsed?.plotImage && q.question_type === 'code_write_plot') {
            q.plotImage = parsed.plotImage
          }
          // Align displayed code with typing replay (stored code can be template while replay has edits)
          if (parsed?.typing_replay?.events?.length) {
            const storedCode = String(q.code ?? q.selected_answer ?? parsed.code ?? "")
            const resolved = resolveCodeDisplayWithTypingReplay({
              storedCode,
              typingReplay: parsed.typing_replay as TypingReplay,
            })
            q.code = resolved.displayCode
            q.selected_answer = resolved.displayCode
            if (resolved.mismatchWarning) {
              ;(q as { code_typing_mismatch?: boolean }).code_typing_mismatch = true
            }
          }
        } catch (e) {
          // Not JSON, treat as regular string (code is directly in answer_data)
          q.code = (typeof q.answer_data === 'string' ? q.answer_data : null) || q.selected_answer
        }
      }
      if (isCodeQuestion && !q.code) {
        // Fallback: use selected_answer or answer_data as code
        q.code = q.selected_answer || (typeof q.answer_data === 'string' ? q.answer_data : null)
      }
      
      return q
    })
    

    // Calculate total points from all questions (not total_questions which may be 0)
    // CRITICAL: This must match the sum of all question max_points for accurate percentage
    // This calculation is dynamic and works for ANY number of questions with ANY point values
    // Example: 20 questions at 5 points each = 100 total points
    // Example: 15 questions at 3 points each = 45 total points
    // Example: Mixed points (5, 3, 2, etc.) = sum of all max_points
    const totalPointsResult = await sql`
      SELECT COALESCE(SUM(COALESCE(max_points, points, 1)), 0) as total_points
      FROM quiz_questions
      WHERE quiz_id = ${attempt.quiz_id}
    `
    const totalPoints = parseFloat(totalPointsResult[0]?.total_points || 0)
    
    // CRITICAL: If totalPoints is 0 or NaN, calculate from question count as fallback
    // This handles cases where questions don't have max_points/points set
    const effectiveTotalPoints = (totalPoints > 0 && !isNaN(totalPoints)) 
      ? totalPoints 
      : (questions.length > 0 ? questions.length : 1)
    
    // CRITICAL: For finals, always use 100 as the denominator for percentage calculation
    const isFinalExam = attempt.assessment_type === 'final'
    const FINAL_EXAM_TOTAL_POINTS = 100
    
    // CRITICAL: Recalculate actual score from points_earned in answers
    // Use INNER JOIN - only count answers for questions in the CURRENT quiz
    // (Prevents score > total when quiz was edited or orphaned/duplicate answers exist)
    const actualScoreResult = await sql`
      WITH unique_answers AS (
        SELECT DISTINCT ON (qa.question_id)
          qa.question_id,
          LEAST(
            COALESCE(qa.override_points, qa.points_earned,
              CASE WHEN qa.is_correct = true THEN COALESCE(qq.max_points, qq.points, 1) ELSE 0 END,
              0
            ),
            COALESCE(qq.max_points, qq.points, 1)
          ) as effective_points
        FROM quiz_answers qa
        INNER JOIN quiz_questions qq ON qq.id = qa.question_id AND qq.quiz_id = ${attempt.quiz_id}
        WHERE qa.attempt_id = ${attemptIdNum}
        ORDER BY qa.question_id, COALESCE(qa.override_points, qa.points_earned) DESC NULLS LAST
      )
      SELECT 
        COALESCE(SUM(ua.effective_points), 0) as actual_score,
        COUNT(ua.question_id) as answered_count
      FROM unique_answers ua
    `
    const actualScore = parseFloat(actualScoreResult[0]?.actual_score || 0)
    const answeredCount = Number(actualScoreResult[0]?.answered_count || 0)
    
    // Get detailed breakdown for ALL questions (including unanswered)
    // CRITICAL: Include ALL questions, not just answered ones, so weights sum to 100%
    const scoreBreakdown = await sql`
      SELECT DISTINCT ON (qq.id)
        qq.id as question_id,
        LEAST(
          COALESCE(qa.override_points, qa.points_earned, 0),
          COALESCE(qq.max_points, qq.points, 1)
        ) as points_earned,
        COALESCE(qa.is_correct, false) as is_correct,
        COALESCE(qq.max_points, qq.points, 1) as max_points,
        COALESCE(qq.points, 1) as points,
        qq.question_type,
        qq.question_order,
        (qa.id IS NOT NULL) as has_answer
      FROM quiz_questions qq
      LEFT JOIN quiz_answers qa ON qa.question_id = qq.id AND qa.attempt_id = ${attemptIdNum}
      WHERE qq.quiz_id = ${attempt.quiz_id}
      ORDER BY qq.id, COALESCE(qa.override_points, qa.points_earned) DESC NULLS LAST, qq.question_order ASC
    `
    ;(scoreBreakdown as Array<{ question_order?: number }>).sort(
      (a, b) => (Number(a.question_order) || 999) - (Number(b.question_order) || 999),
    )

    // CRITICAL FIX: Recalculate total points from scoreBreakdown if totalPointsResult was 0
    // This ensures we always have the correct total points for percentage calculation
    if (totalPoints === 0 && scoreBreakdown.length > 0) {
      const recalculatedTotal = scoreBreakdown.reduce((sum, q) => sum + Number(q.max_points || q.points || 1), 0)
      if (recalculatedTotal > 0) {
        console.log(`[v0] Recalculated total points from scoreBreakdown: ${recalculatedTotal} (was ${totalPoints})`)
        // Update effectiveTotalPoints to use recalculated value
        const newEffectiveTotalPoints = recalculatedTotal
        // Update percentageDenominator for weighted calculation
        const newPercentageDenominator = newEffectiveTotalPoints
        // Recalculate weighted percentage with correct denominator
        if (newPercentageDenominator > 0 && scoreBreakdown.length > 0) {
          let totalWeightedScore = 0
          scoreBreakdown.forEach(q => {
            const maxPoints = q.max_points || 1
            const pointsEarned = q.points_earned || 0
            const weight = maxPoints / newPercentageDenominator
            const questionScore = maxPoints > 0 ? (pointsEarned / maxPoints) : 0
            const weightedScore = questionScore * weight
            totalWeightedScore += weightedScore
          })
          weightedPercentage = totalWeightedScore * 100
        }
      }
    }
    
    // Use actual score from answers, fallback to attempt.score if no answers found
    let finalScore = answeredCount > 0 ? actualScore : parseFloat(attempt.score || 0)
    // CRITICAL: Cap score at total - never display > 100% (fixes 5.20/5 bug)
    if (effectiveTotalPoints > 0 && finalScore > effectiveTotalPoints) {
      console.warn(`[v0] WARNING: Capping score ${finalScore} at total ${effectiveTotalPoints}`)
      finalScore = effectiveTotalPoints
    }
    
    // CRITICAL: Use actual total points for percentage calculation (not a fixed 100)
    // For finals retake, the total points is 23, so percentage should be (score / 23) * 100
    const percentageDenominator = effectiveTotalPoints
    
    // Calculate weighted percentage: Each question's weight = (max_points / total_points)
    // Percentage = Sum of (points_earned / max_points) * weight for ALL questions * 100
    // CRITICAL: Include ALL questions (unanswered = 0 points) so weights sum to 100%
    let weightedPercentage = 0
    if (percentageDenominator > 0 && scoreBreakdown.length > 0) {
      // Calculate percentage using weighted scores for ALL questions
      let totalWeightedScore = 0
      scoreBreakdown.forEach(q => {
        const maxPoints = q.max_points || 1
        const pointsEarned = q.points_earned || 0 // Unanswered questions = 0
        const weight = maxPoints / percentageDenominator // Weight of this question
        const questionScore = maxPoints > 0 ? (pointsEarned / maxPoints) : 0 // Score for this question (0-1)
        const weightedScore = questionScore * weight // Weighted contribution
        totalWeightedScore += weightedScore
      })
      weightedPercentage = totalWeightedScore * 100
    } else if (percentageDenominator > 0) {
      // Fallback: simple calculation if no breakdown available
      weightedPercentage = (finalScore / percentageDenominator) * 100
    } else if (percentageDenominator === 0 && questions.length > 0) {
      // CRITICAL FIX: If percentageDenominator is 0 but we have questions, recalculate total points
      // This handles cases where questions don't have max_points set properly
      console.warn("[v0] WARNING: percentageDenominator is 0 but questions exist, recalculating total points")
      // Recalculate total points from questions - each question should have at least 1 point
      const recalculatedTotalPoints = questions.reduce((sum, q) => {
        const qPoints = q.max_points || q.points || 1
        return sum + Number(qPoints)
      }, 0)
      if (recalculatedTotalPoints > 0) {
        weightedPercentage = (finalScore / recalculatedTotalPoints) * 100
      } else {
        // Last resort: use question count only if all questions have 0 points (shouldn't happen)
        console.error("[v0] ERROR: All questions have 0 points, using question count as last resort")
        weightedPercentage = questions.length > 0 ? (finalScore / questions.length) * 100 : 0
      }
    }
    
    // CRITICAL: Calculate percentage correctly using actual total_possible_points
    // Don't cap at 100% - use the actual ratio of points_earned / total_possible_points * 100
    // Ensure percentage is never NaN or Infinity
    const percentage = isNaN(weightedPercentage) || !isFinite(weightedPercentage)
      ? 0
      : Math.max(0, Math.round(weightedPercentage * 10) / 10) // Floor at 0%, round to 1 decimal, no cap
    
    // Count correct answers for display (X / total questions format)
    const correctAnswersCount = questions.filter(q => q.is_correct === true).length
    const totalQuestions = questions.length
    
    const sectionConfig = parseAssessmentSectionConfig(
      attempt.section_config as SectionConfig[] | string | null | undefined,
    )
    const useSectionWeighting = assessmentUsesSectionWeightedGrade(
      attempt.assessment_type ?? "quiz",
      sectionConfig,
    )

    let finalPercentage = 0
    let sectionBreakdown: Array<{ title: string; earned: number; max: number; weightPercent: number; sectionPercentage: number }> = []
    if (useSectionWeighting && scoreBreakdown.length > 0) {
      const sectionQuestionSelections = await resolveSectionQuestionSelectionsForAttempt(
        attemptIdNum,
        attempt.quiz_id,
        sectionConfig,
      )
      const perQuestion = scoreBreakdown.map(
        (q: { max_points: number; points_earned: number; has_answer?: boolean }) => ({
          max_points: Number(q.max_points ?? 1),
          effective_points: Number(q.points_earned ?? 0),
          answered: q.has_answer === true,
        }),
      )
      const answeredQuestionIds = new Set(
        scoreBreakdown
          .filter((q: { has_answer?: boolean; question_id?: number; id?: number }) => q.has_answer)
          .map((q: { question_id?: number; id?: number }) => q.question_id ?? q.id)
          .filter((id): id is number => id != null),
      )
      const sectionScores = computeSectionScoreRows(
        scoreBreakdown.map(
          (q: { question_type: string; question_id?: number; id?: number; question_order?: number }) => ({
            question_type: q.question_type,
            question_order: q.question_order,
            id: q.question_id ?? q.id,
          }),
        ),
        perQuestion,
        sectionConfig,
        { sectionQuestionSelections, answeredQuestionIds },
      ) as Array<{ earned: number; max: number; weightPercent: number; title: string }>
      finalPercentage = Math.max(
        0,
        Math.min(100, Math.round(calculateWeightedScore(sectionScores) * 10) / 10),
      )
      sectionBreakdown = sectionScores.map(({ earned, max, weightPercent, title }) => ({
        title,
        earned,
        max,
        weightPercent,
        sectionPercentage: max > 0 ? Math.round((earned / max) * 1000) / 10 : 0,
      }))
      // Attach section info to each question for UI grouping
      const sectionsForQuestions = groupQuestionsBySections(
        scoreBreakdown.map((q: any) => ({
          question_type: q.question_type,
          question_order: Number(q.question_order) || undefined,
        })),
        sectionConfig
      )
      for (let i = 0; i < questions.length; i++) {
        const section = sectionsForQuestions.find((s) => s.questionIndices.includes(i))
        if (section) {
          (questions[i] as any).section_title = section.title
          ;(questions[i] as any).section_weight_percent = section.weightPercent
        }
      }
    } else if (effectiveTotalPoints > 0 && finalScore >= 0) {
      // Calculate percentage as (points earned / total possible points) * 100
      // This works for any number of questions and any point values per question
      const pointsBasedPercentage = (finalScore / effectiveTotalPoints) * 100
      finalPercentage = Math.max(0, Math.round(pointsBasedPercentage * 10) / 10) // Round to 1 decimal, floor at 0%
    } else if (totalQuestions > 0) {
      // Fallback: If total points is 0 or invalid, recalculate from questions
      console.warn("[v0] WARNING: effectiveTotalPoints is 0, recalculating from questions")
      // Recalculate total points from questions
      const recalculatedTotalPoints = questions.reduce((sum, q) => {
        const qPoints = q.max_points || q.points || 1
        return sum + Number(qPoints)
      }, 0)
      if (recalculatedTotalPoints > 0) {
        const pointsBasedPercentage = (finalScore / recalculatedTotalPoints) * 100
        finalPercentage = Math.max(0, Math.round(pointsBasedPercentage * 10) / 10)
      } else {
        // Last resort: If points can't be determined, use 0% rather than incorrect count-based calculation
        // CRITICAL: Never use correct_answers count for scoring - always use points earned
        console.error("[v0] ERROR: Cannot determine total points, setting percentage to 0% (points-based scoring required)")
        finalPercentage = 0
      }
    } else {
      // Last resort: use weighted percentage if available
      console.warn("[v0] WARNING: No questions found, using weighted percentage as fallback")
      finalPercentage = percentage
    }

    // Mid-semester fix: finalize-quiz stores score as % (0-100). If we computed >100%, use stored score.
    const isMidSemester = attempt.assessment_type === 'mid_semester' || attempt.assessment_type === 'midsem'
    const storedScore = parseFloat(attempt.score || 0)
    if (isMidSemester && storedScore > 0 && storedScore <= 100 && finalPercentage > 100) {
      finalPercentage = Math.max(0, Math.min(100, Math.round(storedScore * 10) / 10))
    }

    // Ensure every question with answer_data has a displayable selected_answer for the UI
    for (const q of questions as any[]) {
      const sa = q.selected_answer
      if ((sa == null || String(sa).trim() === '') && q.answer_data) {
        try {
          const ad = typeof q.answer_data === 'string' ? JSON.parse(q.answer_data) : q.answer_data
          if (q.question_type?.toLowerCase() === 'multi_part' && ad && typeof ad === 'object' && (ad.parts || ad.solution_uploads || ad.version === 1)) {
            q.selected_answer = typeof q.answer_data === 'string' ? q.answer_data : JSON.stringify(ad)
          } else if (ad && typeof ad === 'object' && ad.answer != null) {
            q.selected_answer = typeof ad.answer === 'string' ? ad.answer : JSON.stringify(ad.answer)
          }
        } catch {
          // ignore
        }
      }
    }

    // [TYPING-REPLAY-DEBUG] Log what we're returning for code questions
    for (const q of questions as any[]) {
      const qt = (q.question_type || "").toLowerCase()
      if (["code_write", "code_problem", "debug_code", "code_explain", "code_write_plot", "code_debug"].includes(qt) && q.answer_data) {
        try {
          const ad = typeof q.answer_data === "string" ? JSON.parse(q.answer_data) : q.answer_data
          const hasReplay = !!ad?.typing_replay
          const eventCount = ad?.typing_replay?.events?.length ?? 0
          console.log("[student/results] [TYPING-REPLAY] returning", { attemptId, questionId: q.question_id, hasReplay, eventCount })
        } catch {
          /* ignore */
        }
      }
    }

    // When section weighting: score/total are on 0-100 scale for display (e.g. 83/100)
    let displayScore = useSectionWeighting ? finalPercentage : parseFloat(finalScore.toFixed(2))
    let displayTotalPoints = useSectionWeighting ? 100 : effectiveTotalPoints

    const totalScoreOvRaw = (attempt as { total_score_override?: unknown }).total_score_override
    if (
      !(totalScoreOvRaw === null || totalScoreOvRaw === undefined || totalScoreOvRaw === "")
    ) {
      const ov = Number(totalScoreOvRaw)
      if (Number.isFinite(ov)) {
        if (useSectionWeighting) {
          const capped = Math.min(100, Math.max(0, Math.round(ov * 100) / 100))
          displayScore = capped
          displayTotalPoints = 100
          finalPercentage = capped
        } else if (isMidSemesterOverrideType(String(attempt.assessment_type ?? ""))) {
          const pct = Math.min(100, Math.max(0, Math.round(ov * 100) / 100))
          finalPercentage = pct
          displayTotalPoints = effectiveTotalPoints > 0 ? effectiveTotalPoints : 100
          displayScore =
            effectiveTotalPoints > 0
              ? Math.round((pct / 100) * effectiveTotalPoints * 100) / 100
              : 0
        } else {
          const cap = effectiveTotalPoints > 0 ? effectiveTotalPoints : ov
          const raw = Math.min(Math.max(0, ov), cap)
          displayScore = raw
          displayTotalPoints = effectiveTotalPoints > 0 ? effectiveTotalPoints : raw
          finalPercentage =
            effectiveTotalPoints > 0
              ? Math.round((raw / effectiveTotalPoints) * 10000) / 100
              : 0
        }
      }
    }

    const pndQuestions = (questions as any[]).map((q: any) => ({
      question_type: q.question_type,
      points_earned: q.points_earned,
      answer_data: q.answer_data,
      selected_answer: q.selected_answer,
      requires_review: q.requires_review === true,
      override_points: q.override_points ?? null,
      reviewed_by: q.reviewed_by ?? null,
      reviewed_at: q.reviewed_at != null ? String(q.reviewed_at) : null,
    }))
    const { shouldShowPnd, violationLog: derivedViolationLog } = deriveViolationLogAndShouldShowPnd(
      { violation_log: attempt.violation_log },
      pndQuestions
    )
    const violationLog = derivedViolationLog
    const existingLogStr = JSON.stringify(Array.isArray(attempt.violation_log) ? attempt.violation_log : [])
    const newLogStr = JSON.stringify(violationLog)
    if (newLogStr !== existingLogStr) {
      await sql`UPDATE quiz_attempts SET violation_log = ${newLogStr}::jsonb WHERE id = ${attemptId}`
    }

    const resultsReviewLocked = (attempt as { lock_student_results_review?: boolean }).lock_student_results_review === true

    if (!request.headers.get("x-instructor-id")?.trim() && !resultsReviewLocked) {
      void (async () => {
        try {
          const studentId = Number(attempt.student_id)
          const quizId = Number(attempt.quiz_id)
          const courseRow = await sql`SELECT course_id FROM quizzes WHERE id = ${quizId} LIMIT 1`
          const courseId = courseRow[0]?.course_id != null ? Number(courseRow[0].course_id) : null
          const hasAiFeedback = (questions as Array<{ ai_feedback?: unknown }>).some(
            (q) => q.ai_feedback != null && typeof q.ai_feedback === "object",
          )
          if (studentId > 0 && hasAiFeedback) {
            const { recordFeedbackAnalytics } = await import("@/lib/institutions/learning-analytics")
            await recordFeedbackAnalytics({
              studentId,
              attemptId: Number(attemptId),
              quizId,
              courseId,
              aiGraded: true,
              event: "feedback_viewed",
            })
          }
        } catch {
          /* non-blocking */
        }
      })()
    }

    const response = {
      student_name: attempt.student_name,
      student_id: attempt.student_id,
      section: attempt.section,
      quiz_id: attempt.quiz_id,
      quiz_title: attempt.quiz_title,
      assessment_type: attempt.assessment_type || "quiz",
      score: displayScore, // Weighted: 0-100 scale; else: raw points
      total_questions: totalQuestions, // Use actual question count
      total_points: displayTotalPoints, // Weighted: 100; else: effectiveTotalPoints
      percentage: finalPercentage, // Use finalPercentage which includes fallback if needed
      // NOTE: correct_answers is for informational display only (count of correct questions)
      // CRITICAL: Scoring MUST use points_earned/score, NOT correct_answers count
      // correct_answers does NOT equal points scored (e.g., 4 correct questions ≠ 0.4 points)
      ...(resultsReviewLocked
        ? {}
        : {
            correct_answers: correctAnswersCount, // Informational only - NOT used for scoring
          }),
      results_review_locked: resultsReviewLocked,
      questions: resultsReviewLocked ? [] : questions, // Stripped when instructor locks post-exam review
      tab_switch_count: attempt.tab_switch_count || 0,
      copy_paste_attempts: attempt.copy_paste_attempts || 0,
      mouse_leave_count: attempt.mouse_leave_count || 0,
      violation_log: violationLog.length > 0 ? violationLog : [],
      should_show_pnd: shouldShowPnd,
      auto_submitted: attempt.auto_submitted || false,
      violation_reason: attempt.violation_reason || null,
      gemini_strikes_count: attempt.gemini_strikes_count || 0,
      pdf_downloaded_at: attempt.pdf_downloaded_at || null,
      has_downloaded_pdf: attempt.pdf_downloaded_at !== null,
      student_bulk_re_evaluate_used_at: (attempt as any).student_bulk_re_evaluate_used_at || null,
      can_continue: !attempt.completed_at && !!attempt.saved_for_later_at,
      started_at: attempt.started_at ?? null,
      completed_at: attempt.completed_at ?? null,
      ...(sectionBreakdown.length > 0 &&
        !resultsReviewLocked && {
          section_breakdown: sectionBreakdown,
          section_config: sectionConfig,
        }),
      ...resultsFinalizedFieldsFromAttempt(attempt as Record<string, unknown>),
    }


    return NextResponse.json(response)
  } catch (error: any) {
    console.error("[v0] Failed to fetch results:", error)
    console.error("[v0] Error details:", {
      message: error.message,
      stack: error.stack,
      code: error.code,
      detail: error.detail
    })
    return NextResponse.json({ 
      error: error.message || "Failed to fetch results. Please try again.",
      details: error.detail || error.message
    }, { status: 500 })
  }
}
