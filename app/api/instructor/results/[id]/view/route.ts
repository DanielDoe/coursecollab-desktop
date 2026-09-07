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
import { isCodeAnswerCorrupt } from "@/lib/code-answer-validation"
import { getDualCodeComparison, resolveCodeDisplayWithTypingReplay } from "@/lib/code-typing-consistency"
import { deriveViolationLogAndShouldShowPnd } from "@/lib/results-pnd"
import { reconcileStoredQuestionPointsForDisplay } from "@/lib/ai-points-consistency"
import { repairStaleCircuitZeroOverride } from "@/lib/circuit-submission"
import { flattenStoredAiFeedback } from "@/lib/flatten-stored-ai-feedback"
import { isMidSemesterOverrideType } from "@/lib/instructor-score-override"
import { ensureResultsFinalizedColumns } from "@/lib/ensure-results-finalized-columns"
import { resultsFinalizedFieldsFromAttempt } from "@/lib/results-finalized"
import { getAttemptDisplayGradesBatch } from "@/lib/attempt-grade-display"
import { batchComputeShouldShowPnd } from "@/lib/results-pnd"
import { getAssessmentConfig } from "@/lib/assessment-core/db"

/** Effective points for one question row (override wins; cap at max). Matches list/summary SQL semantics. */
function effectivePointsFromQuestionRow(q: {
  override_points?: number | null
  points_earned?: number | null
  max_points?: number
  points?: number
}): number {
  const max = Number(q.max_points || q.points || 1)
  const raw = q.override_points != null ? Number(q.override_points) : Number(q.points_earned ?? 0)
  return Math.min(Math.max(0, raw), max > 0 ? max : 1)
}

export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { requireInstructorAttemptAccess } = await import("@/lib/instructor-results-auth")
    const { id } = await params
    const access = await requireInstructorAttemptAccess(request, id)
    if (!access.ok) return access.response
    const attemptId = String(access.attemptId)

    await ensureResultsFinalizedColumns()

    const attemptResult = await sql`
      SELECT 
        qa.*,
        q.id as quiz_id,
        q.title as quiz_title,
        q.assessment_type,
        q.section_config,
        s.full_name as student_name,
        s.student_id,
        s.section
      FROM quiz_attempts qa
      JOIN quizzes q ON qa.quiz_id = q.id
      JOIN students s ON qa.student_id = s.id
      WHERE qa.id = ${attemptId}
        AND qa.deleted_at IS NULL
    `

    if (attemptResult.length === 0) {
      return NextResponse.json({ error: "Quiz attempt not found." }, { status: 404 })
    }

    const attempt = attemptResult[0] as Record<string, unknown>
    const attemptIdNum = parseInt(String(attemptId), 10)
    const savedForLaterAt = attempt.saved_for_later_at as string | null | undefined

    // Read-only instructor preview: never stamp completed_at here (UPDATE triggers profile sync and can 500).
    if (attempt.completed_at == null && !savedForLaterAt) {
      return NextResponse.json(
        {
          error: "Attempt in progress",
          message:
            "This student is still taking the assessment. Results will be available after they submit.",
          is_in_progress: true,
          student_name: attempt.student_name,
          quiz_title: attempt.quiz_title,
        },
        { status: 409 },
      )
    }

    // Load questions for this quiz only (no JOIN to answers — we attach answers by position so we never lose data when question IDs were replaced).
    let questions = await sql`
      SELECT
        q.id as question_id,
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
        NULL::text as override_comment
      FROM quiz_questions q
      WHERE q.quiz_id = ${attempt.quiz_id}
      ORDER BY q.question_order ASC NULLS LAST, q.id ASC
    `

    // Always load ALL saved answers for this attempt (even when question_id no longer exists in quiz_questions).
    const answersForAttempt = await sql`
      SELECT qa.id as answer_id, qa.question_id, qa.selected_answer, qa.answer_data,
             qa.points_earned, qa.is_correct, qa.ai_feedback,
             qa.override_points, qa.reviewed_by, qa.reviewed_at, qa.override_comment,
             qa.requires_review, qa.time_spent_seconds,
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
        const effectivePoints =
          a.override_points != null ? Number(a.override_points) : (a.points_earned != null ? Number(a.points_earned) : 0)
        q.points_earned = effectivePoints
        q.is_correct = a.is_correct === true
        q.ai_feedback = a.ai_feedback
        q.requires_review = a.requires_review === true
        const rawTime = a.time_spent_seconds != null ? Number(a.time_spent_seconds) : null
        const timeLimit = q.time_limit != null ? Number(q.time_limit) : null
        q.time_spent_seconds = rawTime != null
          ? (timeLimit != null && timeLimit > 0 && rawTime > timeLimit ? timeLimit : rawTime)
          : null
        if (a.override_points != null) q.override_points = a.override_points
        if (a.reviewed_by != null) q.reviewed_by = a.reviewed_by
        if (a.reviewed_at != null) q.reviewed_at = a.reviewed_at
        if (a.override_comment != null) q.override_comment = a.override_comment
        // Extract selected_answer/code: for code questions prefer answer_data.code, then answer_data.answer, then selected_answer
        // RECOVERY: If stored value looks corrupt (single letter, very short) but we have typing_replay, derive from replay
        const qtLower = (q as any).question_type?.toLowerCase()
        const isCodeQ = ['code_write', 'code_problem', 'debug_code', 'code_explain', 'code_write_plot', 'code_debug'].includes(qtLower)
        const isMultiPartQ = qtLower === 'multi_part'
        let extracted = a.selected_answer != null && String(a.selected_answer).trim() !== '' ? a.selected_answer : null
        let parsedAd: { code?: string; answer?: unknown; typing_replay?: { events?: Array<{ t: number }> }; parts?: unknown; solution_uploads?: unknown; version?: number } | null = null
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

    // Calculate total points from all questions (not total_questions which may be 0)
    // CRITICAL: Include ALL questions including bonus questions - count every question in the quiz
    // Use the questions array length as the authoritative count since it includes all questions
    const totalPointsResult = await sql`
      SELECT COALESCE(SUM(COALESCE(max_points, points, 1)), 0) as total_points,
             COUNT(*) as question_count
      FROM quiz_questions
      WHERE quiz_id = ${attempt.quiz_id}
    `
    const totalPoints = parseFloat(totalPointsResult[0]?.total_points || 0)
    const questionCountFromDB = Number(totalPointsResult[0]?.question_count || 0)
    
    // CRITICAL: Use the actual questions array length as the authoritative count
    // This ensures we count ALL questions that will be displayed, including any that might be filtered elsewhere
    const actualQuestionCount = questions.length
    
    // CRITICAL: For finals, use 100 as the total points for percentage calculation
    // Finals should total 100 points regardless of what's stored in the database
    const isFinalExam = attempt.assessment_type === 'final'
    const FINAL_EXAM_TOTAL_POINTS = 100
    
    // CRITICAL: Use totalPoints if available, otherwise use question count
    // BUT for finals, always use 100 as the denominator for percentage
    // CRITICAL FIX: Recalculate total points from questions array if DB query doesn't match
    // This ensures we always have the correct total
    let effectiveTotalPoints = isFinalExam 
      ? FINAL_EXAM_TOTAL_POINTS 
      : ((totalPoints > 0 && !isNaN(totalPoints)) 
          ? totalPoints 
          : (actualQuestionCount > 0 ? actualQuestionCount : 1))
    
    // CRITICAL SAFEGUARD: If question count doesn't match, recalculate from questions array
    if (!isFinalExam && actualQuestionCount !== questionCountFromDB) {
      console.warn(`[v0] WARNING: Question count mismatch. DB: ${questionCountFromDB}, Questions array: ${actualQuestionCount}. Recalculating total points.`)
      const recalculatedFromArray = questions.reduce((sum, q) => {
        const qPoints = q.max_points || q.points || 1
        return sum + Number(qPoints)
      }, 0)
      if (recalculatedFromArray > 0) {
        effectiveTotalPoints = recalculatedFromArray
        console.log(`[v0] Recalculated total points from questions array: ${effectiveTotalPoints}`)
      }
    }
    
    // CRITICAL: Recalculate actual score from points_earned in answers
    // CRITICAL FIX: Only count answers for questions that exist in the CURRENT quiz
    // (Excludes orphaned answers from deleted/replaced questions - prevents score > total bug)
    // Use INNER JOIN so we never sum points from questions no longer in the quiz
    const actualScoreResult = await sql`
      WITH unique_answers AS (
        SELECT DISTINCT ON (qa.question_id)
          qa.question_id,
          LEAST(
            COALESCE(qa.override_points, qa.points_earned, 0),
            COALESCE(qq.max_points, qq.points, 1)
          ) as effective_points,
          qa.points_earned,
          qa.is_correct,
          qq.max_points,
          qq.points
        FROM quiz_answers qa
        INNER JOIN quiz_questions qq ON qq.id = qa.question_id AND qq.quiz_id = ${attempt.quiz_id}
        WHERE qa.attempt_id = ${attemptIdNum}
        ORDER BY qa.question_id, COALESCE(qa.override_points, qa.points_earned) DESC NULLS LAST
      )
      SELECT 
        SUM(COALESCE(ua.effective_points, 0)) as actual_score,
        COUNT(ua.question_id) as answered_count,
        SUM(COALESCE(ua.effective_points, 0)) as sum_points_earned_only
      FROM unique_answers ua
    `
    const actualScore = parseFloat(actualScoreResult[0]?.actual_score || 0)
    const sumPointsEarnedOnly = parseFloat(actualScoreResult[0]?.sum_points_earned_only || 0)
    const answeredCount = Number(actualScoreResult[0]?.answered_count || 0)
    
    // CRITICAL: Use recalculated score when stored score is invalid or exceeds total
    const storedScore = parseFloat(attempt.score || 0)
    let finalScore = storedScore

    // CRITICAL SAFEGUARD: Score cannot exceed total points (e.g. 5.20/5 is impossible)
    // Causes: orphaned answers, duplicate answers, quiz edited after attempt, AI over-scoring
    if (effectiveTotalPoints > 0 && storedScore > effectiveTotalPoints) {
      console.warn(`[v0] WARNING: Stored score (${storedScore}) > total (${effectiveTotalPoints}). Using recalculated score (${sumPointsEarnedOnly}) from current quiz questions only.`)
      finalScore = sumPointsEarnedOnly
    }

    // CRITICAL SAFEGUARD: If stored score is missing or invalid, use calculated score
    if (!storedScore || isNaN(storedScore) || !isFinite(storedScore)) {
      console.warn(`[v0] WARNING: Stored score invalid (${storedScore}), using calculated score (${sumPointsEarnedOnly})`)
      finalScore = answeredCount > 0 ? sumPointsEarnedOnly : 0
    }

    // CRITICAL SAFEGUARD: Ensure score is not accidentally multiplied by 10
    if (storedScore > 0 && sumPointsEarnedOnly > 0) {
      const ratio = storedScore / sumPointsEarnedOnly
      if (ratio > 9.5 && ratio < 10.5) {
        console.warn(`[v0] WARNING: Stored score (${storedScore}) appears to be 10x calculated score (${sumPointsEarnedOnly}). Using calculated score.`)
        finalScore = sumPointsEarnedOnly
      }
    }

    // Ensure score is a valid number and not NaN
    if (isNaN(finalScore) || !isFinite(finalScore)) {
      console.error(`[v0] ERROR: Invalid finalScore (${finalScore}), using sumPointsEarnedOnly (${sumPointsEarnedOnly})`)
      finalScore = sumPointsEarnedOnly || 0
    }

    // CRITICAL: Cap score at total - never display > 100%
    if (effectiveTotalPoints > 0 && finalScore > effectiveTotalPoints) {
      console.warn(`[v0] WARNING: Capping score ${finalScore} at total ${effectiveTotalPoints}`)
      finalScore = effectiveTotalPoints
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
          q.ai_feedback = flattenStoredAiFeedback(parsed) ?? {
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
      } else if (q.ai_feedback && typeof q.ai_feedback === "object") {
        q.ai_feedback = flattenStoredAiFeedback(q.ai_feedback) ?? q.ai_feedback
      }
      
      // Parse answer_data for code questions to extract code and plot images
      const isCodeQuestion = ['code_write', 'code_problem', 'debug_code', 'code_explain', 'code_write_plot', 'code_debug'].includes(q.question_type?.toLowerCase())
      
      if (q.answer_data && isCodeQuestion) {
        try {
          const parsed =
            typeof q.answer_data === "string" ? JSON.parse(q.answer_data) : q.answer_data
          if (parsed && typeof parsed === "object") {
            if (parsed.code) q.code = parsed.code
            else if (parsed.answer) q.code = parsed.answer
            if (parsed.plotImage && q.question_type === "code_write_plot") {
              q.plotImage = parsed.plotImage
            }
            // Typing replay is ground truth for final editor text; stored JSON.code can lag template
            const tr = parsed.typing_replay as TypingReplay | undefined
            if (tr?.events?.length) {
              const storedCode = String(q.code ?? q.selected_answer ?? parsed.code ?? "")
              const dual = getDualCodeComparison({ storedCode, typingReplay: tr })
              ;(q as { code_saved_snapshot?: string }).code_saved_snapshot = dual.savedCode
              ;(q as { code_from_typing_replay?: string | null }).code_from_typing_replay =
                dual.fromTypingReplay
              ;(q as { code_saved_vs_replay_mismatch?: boolean }).code_saved_vs_replay_mismatch =
                dual.mismatch
              const resolved = resolveCodeDisplayWithTypingReplay({
                storedCode,
                typingReplay: tr,
              })
              q.code = resolved.displayCode
              q.selected_answer = resolved.displayCode
              if (resolved.mismatchWarning) {
                ;(q as { code_typing_mismatch?: boolean }).code_typing_mismatch = true
              }
            } else {
              const storedCode = String(q.code ?? q.selected_answer ?? parsed.code ?? "")
              ;(q as { code_saved_snapshot?: string }).code_saved_snapshot = storedCode
              ;(q as { code_from_typing_replay?: string | null }).code_from_typing_replay = null
              ;(q as { code_saved_vs_replay_mismatch?: boolean }).code_saved_vs_replay_mismatch = false
            }
          }
        } catch {
          q.code =
            typeof q.answer_data === "string" ? q.answer_data : q.selected_answer || q.code
        }
      } else if (isCodeQuestion && !q.code) {
        q.code = q.selected_answer || q.answer_data
      }

      if (isCodeQuestion) {
        const qx = q as {
          code_saved_snapshot?: string
          code_from_typing_replay?: string | null
          code_saved_vs_replay_mismatch?: boolean
        }
        if (qx.code_saved_snapshot === undefined) {
          qx.code_saved_snapshot = String(q.code ?? q.selected_answer ?? "")
        }
        if (qx.code_from_typing_replay === undefined) {
          qx.code_from_typing_replay = null
        }
        if (qx.code_saved_vs_replay_mismatch === undefined) {
          qx.code_saved_vs_replay_mismatch = false
        }
      }

      return q
    })

    for (const q of questions as any[]) {
      repairStaleCircuitZeroOverride(q)
      reconcileStoredQuestionPointsForDisplay(q)
    }

    // CRITICAL FIX: Remove duplicates by question_id to prevent showing same question twice
    const uniqueQuestions = Array.from(
      new Map(questions.map(q => [q.question_id, q])).values()
    ) as any[]

    const sortByQuestionOrder = (a: any, b: any) =>
      (Number(a.question_order) ?? 999) - (Number(b.question_order) ?? 999) ||
      (Number(a.question_id) ?? 0) - (Number(b.question_id) ?? 0)
    const questionsOrdered = [...uniqueQuestions].sort(sortByQuestionOrder)

    // Breakdown + headline score from the same rows the UI renders (post reconcileStoredQuestionPointsForDisplay),
    // not a second SQL pass on stale quiz_answers.points_earned (fixes AI % vs recorded points mismatch).
    const scoreBreakdown = questionsOrdered.map((q: any) => ({
      question_id: q.question_id,
      points_earned: effectivePointsFromQuestionRow(q),
      is_correct: q.is_correct === true,
      max_points: Number(q.max_points || q.points || 1),
      points: Number(q.points || 1),
      question_type: q.question_type,
      question_order: Number(q.question_order) || undefined,
      has_answer: q.answer_id != null,
    }))

    const pointsSumFromDisplayedRows = scoreBreakdown.reduce((s, row) => s + Number(row.points_earned ?? 0), 0)
    if (Math.abs(pointsSumFromDisplayedRows - finalScore) > 0.015) {
      console.warn(
        `[instructor/results/view] attempt ${attemptIdNum}: headline total aligned to displayed questions: ${pointsSumFromDisplayedRows} (previous finalScore ${finalScore}, SQL sum ${sumPointsEarnedOnly})`,
      )
    }
    finalScore = pointsSumFromDisplayedRows
    if (effectiveTotalPoints > 0 && finalScore > effectiveTotalPoints) {
      console.warn(`[instructor/results/view] Capping finalScore ${finalScore} at ${effectiveTotalPoints}`)
      finalScore = effectiveTotalPoints
    }

    // Avg time spent by question type - from recorded time_spent_seconds per question per attempt
    // Include ALL question types in the quiz; use null for types with no recorded time (show N/A in UI)
    let avgTimeByQuestionType: Array<{ question_type: string; avg_seconds: number | null }> = []
    try {
      // 1. Get all question types that exist in this quiz (normalize to lowercase for consistency)
      const quizTypesResult = await sql`
        SELECT DISTINCT LOWER(TRIM(question_type)) as question_type FROM quiz_questions
        WHERE quiz_id = ${attempt.quiz_id} AND question_type IS NOT NULL AND TRIM(question_type) != ''
        ORDER BY 1
      `
      const quizTypes = (quizTypesResult as { question_type: string }[]).map((r) => r.question_type || "unknown")

      // 2. Avg time per type from quiz_answers.time_spent_seconds (recorded per question per attempt)
      // Cap each at question's time_limit; use LOWER for consistent grouping
      const avgTimeByTypeResult = await sql`
        SELECT LOWER(TRIM(qq.question_type)) as question_type,
          ROUND(AVG(LEAST(qa.time_spent_seconds, COALESCE(qq.time_limit, 999999)))::numeric, 1)::numeric as avg_seconds
        FROM quiz_answers qa
        JOIN quiz_attempts qat ON qa.attempt_id = qat.id
        JOIN quiz_questions qq ON qq.id = qa.question_id AND qq.quiz_id = qat.quiz_id
        WHERE qat.quiz_id = ${attempt.quiz_id} AND qa.time_spent_seconds IS NOT NULL AND qa.time_spent_seconds >= 0
        GROUP BY LOWER(TRIM(qq.question_type))
      `
      const avgByType = new Map<string, number>()
      for (const r of avgTimeByTypeResult as { question_type: string; avg_seconds: number }[]) {
        avgByType.set(r.question_type || "unknown", Number(r.avg_seconds || 0))
      }

      // 3. Build result: every quiz type with avg (null if no recorded time for that type)
      avgTimeByQuestionType = quizTypes.map((qt) => ({
        question_type: qt,
        avg_seconds: avgByType.has(qt) ? avgByType.get(qt)! : null,
      }))
    } catch {
      /* column may not exist if migration not run */
    }

    // Ensure every question with answer_data has a displayable selected_answer for the UI
    for (const q of uniqueQuestions) {
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

    const correctAnswersCount = uniqueQuestions.filter(q => q.is_correct === true).length
    const totalQuestions = uniqueQuestions.length
    
    // CRITICAL: For finals, use the actual total points from questions, not a fixed 100
    // The percentage should be calculated as (score / actual_total_points) * 100
    // Use effectiveTotalPoints for all assessments (including finals) to get accurate percentages
    const percentageDenominator = effectiveTotalPoints
    
    const sectionConfig = parseAssessmentSectionConfig(
      attempt.section_config as SectionConfig[] | string | null | undefined,
    )
    const useSectionWeighting = assessmentUsesSectionWeightedGrade(
      attempt.assessment_type ?? "quiz",
      sectionConfig,
    )

    let sectionBreakdown: Array<{ title: string; earned: number; max: number; weightPercent: number; sectionPercentage: number }> = []

    let finalPercentage = 0
    if (useSectionWeighting && scoreBreakdown.length > 0) {
      const sectionQuestionSelections = await resolveSectionQuestionSelectionsForAttempt(
        attemptIdNum,
        attempt.quiz_id as number,
        sectionConfig,
      )
      const answeredQuestionIds = new Set(
        scoreBreakdown
          .filter((q: { has_answer?: boolean; question_id?: number }) => q.has_answer && q.question_id != null)
          .map((q: { question_id: number }) => Number(q.question_id)),
      )
      const perQuestion = scoreBreakdown.map((q: any) => ({
        max_points: Number(q.max_points ?? 1),
        effective_points: Number(q.points_earned ?? 0),
        answered: q.has_answer === true,
      }))
      const sectionScores = computeSectionScoreRows(
        scoreBreakdown.map((q: any) => ({
          question_type: q.question_type,
          question_order: q.question_order,
          id: q.question_id,
        })),
        perQuestion,
        sectionConfig,
        { sectionQuestionSelections, answeredQuestionIds },
      )
      finalPercentage = Math.max(
        0,
        Math.min(100, Math.round(calculateWeightedScore(sectionScores) * 100) / 100),
      )
      sectionBreakdown = sectionScores.map(({ earned, max, weightPercent, title }) => ({
        title,
        earned,
        max,
        weightPercent,
        sectionPercentage: max > 0 ? Math.round((earned / max) * 1000) / 10 : 0,
      }))
      // Attach section info to each question for UI grouping and section navigation
      const sectionsForQuestions = groupQuestionsBySections(
        questionsOrdered.map((q: any) => ({
          question_type: q.question_type,
          question_order: Number(q.question_order) || undefined,
        })),
        sectionConfig
      )
      for (let i = 0; i < questionsOrdered.length; i++) {
        const section = sectionsForQuestions.find((s) => s.questionIndices.includes(i))
        if (section) {
          ;(questionsOrdered[i] as any).section_title = section.title
          ;(questionsOrdered[i] as any).section_weight_percent = section.weightPercent
        }
      }
    } else if (percentageDenominator > 0 && finalScore >= 0 && isFinite(finalScore) && isFinite(percentageDenominator)) {
      // Calculate percentage as (points_earned / total_possible_points) * 100
      const rawPercentage = (finalScore / percentageDenominator) * 100
      
      // CRITICAL VALIDATION: Ensure percentage is reasonable (0-100%)
      if (rawPercentage > 100) {
        console.error(`[v0] ERROR: Percentage > 100% (${rawPercentage}%). Score: ${finalScore}, Total: ${percentageDenominator}`)
        finalPercentage = 100
      } else {
        finalPercentage = Math.max(0, Math.round(rawPercentage * 100) / 100)
      }
    } else if (percentageDenominator === 0 && uniqueQuestions.length > 0) {
      // Fallback: recalculate total points from unique questions if denominator is 0
      const recalculatedTotalPoints = uniqueQuestions.reduce((sum, q) => {
        const qPoints = q.max_points || q.points || 1
        return sum + Number(qPoints)
      }, 0)
      if (recalculatedTotalPoints > 0 && isFinite(finalScore)) {
        const rawPercentage = (finalScore / recalculatedTotalPoints) * 100
        finalPercentage = Math.max(0, Math.round(rawPercentage * 100) / 100)
      }
    }

    // Mid-semester fix: finalize-quiz stores score as % (0-100). If we computed >100%, use stored score.
    const isMidSemester = attempt.assessment_type === 'mid_semester' || attempt.assessment_type === 'midsem'
    if (isMidSemester && storedScore > 0 && storedScore <= 100 && finalPercentage > 100) {
      finalPercentage = Math.max(0, Math.min(100, Math.round(storedScore * 10) / 10))
    }
    
    // CRITICAL SAFEGUARD: Log calculation for debugging
    console.log(`[v0] Percentage Calculation: Score=${finalScore}, Total=${percentageDenominator}, Percentage=${finalPercentage}%`)

    // For section-weighted quizzes (mid-semester 20%+20%+60%), use weighted percentage as score (0-100 scale)
    let formattedScore = useSectionWeighting
      ? finalPercentage
      : parseFloat(finalScore.toFixed(2))
    
    // CRITICAL: Cap at total - never display > 100%
    // When section weighting: score is on 0-100 scale, cap at 100 (not effectiveTotalPoints)
    if (useSectionWeighting) {
      if (formattedScore > 100) {
        console.warn(`[v0] WARNING: Capping weighted score ${formattedScore} at 100`)
        formattedScore = 100
      }
    } else if (effectiveTotalPoints > 0 && formattedScore > effectiveTotalPoints) {
      console.warn(`[v0] WARNING: Capping formatted score ${formattedScore} at total ${effectiveTotalPoints}`)
      formattedScore = effectiveTotalPoints
    }
    
    // Prev/next navigation: get sibling attempts for same quiz, ordered by student name
    const siblings = await sql`
      WITH ordered AS (
        SELECT qa.id, ROW_NUMBER() OVER (ORDER BY s.full_name ASC, qa.completed_at DESC NULLS LAST) as rn
        FROM quiz_attempts qa
        JOIN students s ON s.id = qa.student_id
        WHERE qa.quiz_id = ${attempt.quiz_id} AND qa.deleted_at IS NULL
      )
      SELECT
        (SELECT id FROM ordered WHERE rn = (SELECT rn - 1 FROM ordered WHERE id = ${attemptIdNum})) as prev_attempt_id,
        (SELECT id FROM ordered WHERE rn = (SELECT rn + 1 FROM ordered WHERE id = ${attemptIdNum})) as next_attempt_id,
        (SELECT COUNT(*)::int FROM ordered) as total_count,
        (SELECT rn FROM ordered WHERE id = ${attemptIdNum}) as current_index
    `
    const nav = siblings[0] as { prev_attempt_id: number | null; next_attempt_id: number | null; total_count: number; current_index: number } | undefined

    // When section weighting: score/total are on 0-100 scale for display (e.g. 83/100)
    let displayScore = formattedScore
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
          formattedScore = capped
        } else if (isMidSemesterOverrideType(String(attempt.assessment_type ?? ""))) {
          const pct = Math.min(100, Math.max(0, Math.round(ov * 100) / 100))
          finalPercentage = pct
          displayTotalPoints = effectiveTotalPoints > 0 ? effectiveTotalPoints : 100
          displayScore =
            effectiveTotalPoints > 0
              ? Math.round((pct / 100) * effectiveTotalPoints * 100) / 100
              : 0
          formattedScore = displayScore
        } else {
          const cap = effectiveTotalPoints > 0 ? effectiveTotalPoints : ov
          const raw = Math.min(Math.max(0, ov), cap)
          displayScore = raw
          displayTotalPoints = effectiveTotalPoints > 0 ? effectiveTotalPoints : raw
          finalPercentage =
            effectiveTotalPoints > 0
              ? Math.round((raw / effectiveTotalPoints) * 10000) / 100
              : 0
          formattedScore = raw
        }
      }
    }

    const pndQuestions = (uniqueQuestions as any[]).map((q: any) => ({
      question_type: q.question_type,
      points_earned: q.points_earned,
      answer_data: q.answer_data,
      selected_answer: q.selected_answer,
      requires_review: q.requires_review === true,
      override_points: q.override_points ?? null,
      reviewed_by: q.reviewed_by ?? null,
      reviewed_at: q.reviewed_at != null ? String(q.reviewed_at) : null,
    }))
    const { shouldShowPnd, violationLog } = deriveViolationLogAndShouldShowPnd(
      { violation_log: attempt.violation_log },
      pndQuestions
    )
    const existingLogStr = JSON.stringify(Array.isArray(attempt.violation_log) ? attempt.violation_log : [])
    const newLogStr = JSON.stringify(violationLog)
    if (newLogStr !== existingLogStr) {
      await sql`UPDATE quiz_attempts SET violation_log = ${newLogStr}::jsonb WHERE id = ${attemptIdNum}`
    }

    const cohortStats = await sql`
      WITH quiz_total AS (
        SELECT COALESCE(SUM(COALESCE(qq.max_points, qq.points, 1)), 0)::numeric AS total_pts
        FROM quiz_questions qq
        WHERE qq.quiz_id = ${attempt.quiz_id}
      )
      SELECT
        ROUND(AVG((qa.score::numeric / NULLIF((SELECT total_pts FROM quiz_total), 0)) * 100), 1)::float AS avg_pct,
        ROUND(MAX((qa.score::numeric / NULLIF((SELECT total_pts FROM quiz_total), 0)) * 100), 1)::float AS max_pct
      FROM quiz_attempts qa
      WHERE qa.quiz_id = ${attempt.quiz_id}
        AND qa.deleted_at IS NULL
        AND qa.completed_at IS NOT NULL
        AND (SELECT total_pts FROM quiz_total) > 0
    `
    const cohortRow = cohortStats[0] as { avg_pct: number | null; max_pct: number | null } | undefined

    const siblingRows = await sql`
      SELECT qa.id, qa.attempt_number, qa.score::float, qa.is_final_grade,
        qa.completed_at, qa.results_finalized_at IS NOT NULL AS results_finalized
      FROM quiz_attempts qa
      WHERE qa.quiz_id = ${attempt.quiz_id}
        AND qa.student_id = ${attempt.student_id}
        AND qa.deleted_at IS NULL
        AND qa.completed_at IS NOT NULL
      ORDER BY qa.attempt_number ASC
    `
    const siblingIds = (siblingRows as { id: number }[]).map((r) => Number(r.id))
    const siblingDisplayGrades =
      siblingIds.length > 0 ? await getAttemptDisplayGradesBatch(siblingIds) : new Map()
    const rawAssessmentType = String(attempt.assessment_type ?? "quiz")
    const configKey =
      rawAssessmentType === "mid_semester" || rawAssessmentType === "midsem" ? "midsem" : rawAssessmentType
    const assessmentConfig = getAssessmentConfig(configKey as "quiz" | "homework" | "midsem" | "final")
    const siblingPndMap =
      siblingIds.length > 0 ? await batchComputeShouldShowPnd(siblingIds, assessmentConfig) : new Map()
    const studentAttempts = (siblingRows as Array<{
      id: number
      attempt_number: number
      score: number
      is_final_grade: boolean
      completed_at: string | null
      results_finalized: boolean
    }>).map((r) => {
      const aid = Number(r.id)
      const grade = siblingDisplayGrades.get(aid)
      return {
        id: aid,
        attemptNumber: Number(r.attempt_number),
        score: grade?.score ?? (Number(r.score) || 0),
        percentage: grade?.percentage ?? 0,
        isFinalGrade: r.is_final_grade === true,
        shouldShowPnd: siblingPndMap.get(aid) ?? false,
        resultsFinalized: r.results_finalized === true,
        completedAt: r.completed_at,
      }
    })

    const response = {
      student_name: attempt.student_name,
      student_id: attempt.student_id,
      section: attempt.section,
      quiz_id: attempt.quiz_id,
      quiz_title: attempt.quiz_title,
      assessment_type: attempt.assessment_type || "quiz",
      completed_at: attempt.completed_at ?? null,
      saved_for_later_at: savedForLaterAt ?? null,
      is_paused: attempt.completed_at == null && !!savedForLaterAt,
      score: displayScore, // Weighted: 0-100 scale; else: raw points
      total_questions: totalQuestions, // Use actual question count from unique questions array
      total_points: displayTotalPoints, // Weighted: 100; else: effectiveTotalPoints
      percentage: finalPercentage, // Use finalPercentage which includes fallback if needed
      // NOTE: correct_answers is for informational display only (count of correct questions)
      // CRITICAL: Scoring MUST use points_earned/score, NOT correct_answers count
      // correct_answers does NOT equal points scored (e.g., 4 correct questions ≠ 0.4 points)
      correct_answers: correctAnswersCount, // Informational only - NOT used for scoring
      questions: uniqueQuestions, // Use unique questions to prevent duplicates
      // Prev/next navigation for instructor
      prevAttemptId: nav?.prev_attempt_id ?? null,
      nextAttemptId: nav?.next_attempt_id ?? null,
      totalAttempts: nav?.total_count ?? 1,
      currentIndex: nav?.current_index ?? 1,
      ...(sectionBreakdown.length > 0 && { section_breakdown: sectionBreakdown }),
      ...(avgTimeByQuestionType.length > 0 && { avg_time_by_question_type: avgTimeByQuestionType }),
      violation_log: violationLog,
      should_show_pnd: shouldShowPnd,
      cohort_average_percent:
        cohortRow?.avg_pct != null && !Number.isNaN(Number(cohortRow.avg_pct)) ? Number(cohortRow.avg_pct) : null,
      cohort_top_percent:
        cohortRow?.max_pct != null && !Number.isNaN(Number(cohortRow.max_pct)) ? Number(cohortRow.max_pct) : null,
      section_config: sectionConfig ?? null,
      student_attempts: studentAttempts,
      ...resultsFinalizedFieldsFromAttempt(attempt),
    }

    console.log("[v0] Returning response with", response.questions.length, "questions")
    console.log("[v0] Score:", displayScore, "Total Points:", displayTotalPoints, "Total Questions:", totalQuestions, "Percentage:", finalPercentage)
    console.log("[v0] Validation: Score/Total =", displayScore, "/", displayTotalPoints, "=", (displayTotalPoints > 0 ? (displayScore / displayTotalPoints * 100).toFixed(2) : "N/A") + "%")

    return NextResponse.json(response)
  } catch (error) {
    console.error("[v0] Failed to fetch results:", error)
    return NextResponse.json({ error: "Failed to fetch results. Please try again." }, { status: 500 })
  }
}
