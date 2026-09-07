import { type NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { sql } from "@/lib/db"
import {
  groupQuestionsBySections,
  calculateWeightedScore,
  type SectionConfig,
} from "@/lib/assessment-sections"
import { computeSectionScoreRows } from "@/lib/section-weighted-attempt-score"
import { resolveSectionQuestionSelectionsForAttempt } from "@/lib/load-section-question-selections"
import { ensureResultsFinalizedColumns } from "@/lib/ensure-results-finalized-columns"
import { resultsFinalizedFieldsFromAttempt } from "@/lib/results-finalized"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const attemptId = params.id
    console.log("[v0] Admin viewing results for attempt ID:", attemptId)

    await ensureResultsFinalizedColumns()

    const attemptResult = await sql`
      SELECT 
        qa.*,
        q.id as quiz_id,
        q.title as quiz_title,
        q.section_config,
        q.assessment_type,
        s.full_name as student_name,
        s.student_id,
        s.section
      FROM quiz_attempts qa
      JOIN quizzes q ON qa.quiz_id = q.id
      JOIN students s ON qa.student_id = s.id
      WHERE qa.id = ${attemptId}
    `

    console.log("[v0] Attempt query result:", attemptResult)

    if (attemptResult.length === 0) {
      console.log("[v0] No attempt found for ID:", attemptId)
      return NextResponse.json({ error: "Quiz attempt not found." }, { status: 404 })
    }

    const attempt = attemptResult[0]
    console.log("[v0] Found attempt:", attempt)
    const attemptIdNum = parseInt(String(attemptId), 10)

    // Load questions for this quiz only; attach answers by position so we never lose data when question IDs were replaced.
    const questionsRaw = await sql`
      SELECT
        q.id as question_id,
        q.question_order,
        q.question_text,
        q.question_type,
        q.option_a,
        q.option_b,
        q.option_c,
        q.option_d,
        q.option_e,
        q.correct_answer,
        q.sample_answers,
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

    const answersForAttempt = await sql`
      SELECT qa.id as answer_id, qa.question_id, qa.selected_answer, qa.answer_data,
             qa.points_earned, qa.is_correct, qa.ai_feedback,
             qq.question_order
      FROM quiz_answers qa
      LEFT JOIN quiz_questions qq ON qq.id = qa.question_id AND qq.quiz_id = ${attempt.quiz_id}
      WHERE qa.attempt_id = ${attemptIdNum}
      ORDER BY COALESCE(qq.question_order, 999), qa.question_id, qa.id
    `

    const qListRaw = questionsRaw as any[]
    const aList = answersForAttempt as any[]
    qListRaw.sort((a: any, b: any) => (Number(a?.question_order) ?? 999) - (Number(b?.question_order) ?? 999))

    // Match answers to questions: prefer question_id match (correct when questions unchanged),
    // then fall back to position for orphaned answers (when question was replaced/deleted).
    // Use String keys to avoid number/string type mismatches from DB drivers.
    const questionIds = new Set(qListRaw.map((q: any) => String(q?.question_id ?? '')))
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
    orphaned.sort((x: any, y: any) => (Number(x?.question_order) ?? 999) - (Number(y?.question_order) ?? 999) || (Number(x?.question_id) ?? 0) - (Number(y?.question_id) ?? 0) || (Number(x?.answer_id) ?? 0) - (Number(y?.answer_id) ?? 0))
    let orphanIdx = 0
    for (const q of qListRaw) {
      if (!q) continue
      const qid = q.question_id != null ? String(q.question_id) : ''
      let a = qid ? byQuestionId.get(qid) : null
      if (!a && orphanIdx < orphaned.length) {
        a = orphaned[orphanIdx++]
      }
      if (a) {
        q.answer_id = a.answer_id
        q.answer_data = a.answer_data
        q.points_earned = a.points_earned != null ? Number(a.points_earned) : 0
        q.is_correct = a.is_correct === true
        q.ai_feedback = a.ai_feedback
        // Extract selected_answer: try selected_answer first, then answer_data.answer (handles both object and string JSON)
        let extracted = a.selected_answer != null && String(a.selected_answer).trim() !== '' ? a.selected_answer : null
        if (extracted == null && a.answer_data) {
          try {
            const ad = typeof a.answer_data === 'string' ? JSON.parse(a.answer_data) : a.answer_data
            if (ad && typeof ad === 'object' && ad.answer != null) {
              extracted = typeof ad.answer === 'string' ? ad.answer : JSON.stringify(ad.answer)
            }
          } catch {
            /* ignore */
          }
        }
        q.selected_answer = extracted
      }
    }

    let questions = questionsRaw.map((q: any) => {
      let val = q.selected_answer
      if (val != null && typeof val === 'object') {
        val = (val as Record<string, unknown>).answer != null ? (typeof (val as Record<string, unknown>).answer === 'string' ? (val as Record<string, unknown>).answer : JSON.stringify((val as Record<string, unknown>).answer)) : JSON.stringify(val)
      } else if (val != null) {
        val = String(val).trim() || null
      }
      if ((val === null || val === '') && q.answer_data) {
        try {
          const ad = typeof q.answer_data === 'string' ? JSON.parse(q.answer_data) : q.answer_data
          if (ad && typeof ad === 'object' && ad.answer !== undefined && ad.answer !== null) {
            val = typeof ad.answer === 'string' ? ad.answer : JSON.stringify(ad.answer)
          }
        } catch {
          // ignore
        }
      }
      return { ...q, selected_answer: val ?? null }
    })
    // Ensure every question with answer_data has a displayable selected_answer for the UI
    for (const q of questions) {
      const sa = q.selected_answer
      if ((sa == null || String(sa).trim() === '') && q.answer_data) {
        try {
          const ad = typeof q.answer_data === 'string' ? JSON.parse(q.answer_data) : q.answer_data
          if (ad && typeof ad === 'object' && ad.answer != null) {
            q.selected_answer = typeof ad.answer === 'string' ? ad.answer : JSON.stringify(ad.answer)
          }
        } catch {
          // ignore
        }
      }
    }

    console.log("[v0] Found", questions.length, "questions (including unanswered)")
    
    // Calculate total points from all questions (not total_questions which may be 0)
    // CRITICAL: This must match the sum of all question max_points for accurate percentage
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
    
    // CRITICAL: For finals, use the actual total points from questions, not a fixed 100
    // The percentage should be calculated as (score / actual_total_points) * 100
    const isFinalExam = attempt.assessment_type === 'final'
    // Use effectiveTotalPoints for all assessments (including finals) to get accurate percentages
    const percentageDenominator = effectiveTotalPoints
    
    // CRITICAL: Recalculate actual score from points_earned in answers
    // This ensures accuracy even if quiz_attempts.score is outdated
    const actualScoreResult = await sql`
      SELECT 
        SUM(
          COALESCE(
            qa.points_earned,
            CASE 
              WHEN qa.is_correct = true THEN COALESCE(qq.max_points, qq.points, 1)
              ELSE 0
            END,
            0
          )
        ) as actual_score,
        COUNT(qa.id) as answered_count
      FROM quiz_answers qa
      LEFT JOIN quiz_questions qq ON qq.id = qa.question_id AND qq.quiz_id = ${attempt.quiz_id}
      WHERE qa.attempt_id = ${attemptIdNum}
    `
    const actualScore = parseFloat(actualScoreResult[0]?.actual_score || 0)
    const answeredCount = Number(actualScoreResult[0]?.answered_count || 0)
    
    // Use actual score from answers, fallback to attempt.score if no answers found
    const finalScore = answeredCount > 0 ? actualScore : parseFloat(attempt.score || 0)
    
    // Get detailed breakdown for ALL questions (including unanswered)
    const scoreBreakdown = await sql`
      SELECT 
        qq.id as question_id,
        COALESCE(
          qa.override_points,
          qa.points_earned,
          CASE 
            WHEN qa.is_correct = true THEN COALESCE(qq.max_points, qq.points, 1)
            ELSE 0
          END,
          0
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
      ORDER BY qq.question_order ASC
    `
    
    // Section-weighted scoring ONLY for mid-semester and finals. Quizzes/homework use simple points-based grading.
    const isSectionizedAssessment =
      attempt.assessment_type === "mid_semester" ||
      attempt.assessment_type === "midsem" ||
      attempt.assessment_type === "final"
    const sectionConfig = attempt.section_config as SectionConfig[] | null | undefined
    const useSectionWeighting =
      isSectionizedAssessment &&
      sectionConfig &&
      Array.isArray(sectionConfig) &&
      sectionConfig.length > 0 &&
      sectionConfig.some((s) => s.weight_percent && s.weight_percent > 0)

    let sectionBreakdown: Array<{ title: string; earned: number; max: number; weightPercent: number; sectionPercentage: number }> = []

    // Calculate weighted percentage: Each question's weight = (max_points / total_points)
    // Percentage = Sum of (points_earned / max_points) * weight for ALL questions * 100
    // CRITICAL: Include ALL questions (unanswered = 0 points) so weights sum to 100%
    let weightedPercentage = 0
    if (useSectionWeighting && scoreBreakdown.length > 0) {
      const sectionQuestionSelections = await resolveSectionQuestionSelectionsForAttempt(
        attemptIdNum,
        attempt.quiz_id as number,
        sectionConfig,
      )
      const answeredQuestionIds = new Set(
        (scoreBreakdown as Array<{ question_id: number; has_answer?: boolean }>)
          .filter((q) => q.has_answer && q.question_id != null)
          .map((q) => Number(q.question_id)),
      )
      const perQuestion = scoreBreakdown.map((q: { max_points: number; points_earned: number; has_answer?: boolean }) => ({
        max_points: Number(q.max_points ?? 1),
        effective_points: Number(q.points_earned ?? 0),
        answered: q.has_answer === true,
      }))
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
      )
      weightedPercentage = calculateWeightedScore(sectionScores)
      sectionBreakdown = sectionScores.map(({ earned, max, weightPercent, title }) => ({
        title,
        earned,
        max,
        weightPercent,
        sectionPercentage: max > 0 ? Math.round((earned / max) * 1000) / 10 : 0,
      }))
      // Attach section info to each question for UI grouping and section navigation
      const sectionsForQuestions = groupQuestionsBySections(
        questions.map((q: any) => ({ question_type: q.question_type })),
        sectionConfig
      )
      for (let i = 0; i < questions.length; i++) {
        const section = sectionsForQuestions.find((s) => s.questionIndices.includes(i))
        if (section) {
          (questions[i] as any).section_title = section.title
          ;(questions[i] as any).section_weight_percent = section.weightPercent
        }
      }
    } else if (percentageDenominator > 0 && scoreBreakdown.length > 0) {
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
      // CRITICAL FIX: If percentageDenominator is 0 but we have questions, use question count as fallback
      console.warn("[v0] WARNING: percentageDenominator is 0 but questions exist, using question count fallback")
      weightedPercentage = questions.length > 0 ? (finalScore / questions.length) * 100 : 0
    }
    
    // CRITICAL: Cap percentage at 100% to prevent showing over 100%
    // Ensure percentage is never NaN or Infinity
    let finalPercentage = isNaN(weightedPercentage) || !isFinite(weightedPercentage)
      ? 0
      : Math.max(0, Math.round(weightedPercentage * 10) / 10) // Floor at 0%, round to 1 decimal, no cap - use actual ratio
    
    // CRITICAL: Ensure percentage is never 0 if score > 0 (unless percentageDenominator is actually 0)
    if (finalPercentage === 0 && finalScore > 0 && percentageDenominator > 0) {
      console.error("[v0] ERROR: Percentage is 0 but score > 0! Using fallback calculation...", {
        attemptId,
        quizId: attempt.quiz_id,
        isFinalExam,
        finalScore,
        totalPoints,
        effectiveTotalPoints,
        percentageDenominator,
        weightedPercentage
      })
      // Force recalculation as fallback
      const fallbackPercentage = (finalScore / percentageDenominator) * 100
      finalPercentage = Math.max(0, Math.round(fallbackPercentage * 10) / 10) // No cap - use actual ratio
      console.log("[v0] Using fallback calculation:", finalPercentage, "%")
    }
    
    // Count correct answers for display
    const correctAnswersCount = questions.filter(q => q.is_correct === true).length
    const totalQuestions = questions.length
    
    // CRITICAL FIX: Calculate percentage based on POINTS EARNED / total possible points
    // NEVER use correct_answers count for scoring - always use points earned
    // Skip overwrite when using section-weighted scoring (already set above)
    if (!useSectionWeighting && percentageDenominator > 0 && finalScore >= 0 && isFinite(finalScore) && isFinite(percentageDenominator)) {
      // Calculate percentage as (points earned / total possible points) * 100
      const rawPercentage = (finalScore / percentageDenominator) * 100
      if (rawPercentage > 100) {
        console.error(`[v0] ERROR: Percentage > 100% (${rawPercentage}%). Score: ${finalScore}, Total: ${percentageDenominator}`)
        finalPercentage = 100
      } else {
        finalPercentage = Math.max(0, Math.round(rawPercentage * 10) / 10) // Round to 1 decimal, floor at 0%
      }
      
      console.log("[v0] Admin results calculation (points-based):", {
        attemptId,
        quizId: attempt.quiz_id,
        pointsEarned: finalScore,
        totalPossiblePoints: percentageDenominator,
        percentage: `${finalPercentage}% (calculated from ${finalScore.toFixed(2)} / ${percentageDenominator} points)`,
        correctAnswersCount: correctAnswersCount,
        totalQuestions,
        note: "Percentage calculated from points earned, not correct answer count"
      })
    } else if (totalQuestions > 0) {
      // Fallback: recalculate total points from questions if denominator is 0
      const recalculatedTotalPoints = questions.reduce((sum, q) => {
        const qPoints = q.max_points || q.points || 1
        return sum + Number(qPoints)
      }, 0)
      if (recalculatedTotalPoints > 0 && isFinite(finalScore)) {
        const rawPercentage = (finalScore / recalculatedTotalPoints) * 100
        finalPercentage = Math.max(0, Math.round(rawPercentage * 10) / 10)
      } else {
        // Last resort: If points can't be determined, use 0% rather than incorrect count-based calculation
        console.error("[v0] ERROR: Cannot determine total points, setting percentage to 0% (points-based scoring required)")
        finalPercentage = 0
      }
    } else {
      console.log("[v0] Admin results calculation:", {
        attemptId,
        quizId: attempt.quiz_id,
        attemptScore: attempt.score,
        finalScore,
        totalPoints,
        totalQuestions,
        weightedPercentage: `${weightedPercentage.toFixed(2)}%`,
        finalPercentage: `${finalPercentage}%`,
        correctAnswers: correctAnswersCount,
        warning: "No questions found, using weighted percentage"
      })
    }

    // Parse answer_data for code questions to extract code and plot images (same as instructor view)
    const questionsWithCode = questions.map((q: any) => {
      const isCodeQuestion = ['code_write', 'code_problem', 'debug_code', 'code_explain', 'code_write_plot', 'code_debug'].includes(q.question_type?.toLowerCase())
      if (q.answer_data && typeof q.answer_data === 'string' && isCodeQuestion) {
        try {
          const parsed = JSON.parse(q.answer_data)
          if (parsed.code) q.code = parsed.code
          else if (parsed.answer) q.code = parsed.answer
          if (parsed.plotImage && q.question_type === 'code_write_plot') q.plotImage = parsed.plotImage
        } catch {
          q.code = q.answer_data || q.selected_answer
        }
      } else if (isCodeQuestion && !q.code) {
        q.code = q.selected_answer || q.answer_data
      }
      return q
    })

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

    const response = {
      student_name: attempt.student_name,
      student_id: attempt.student_id,
      section: attempt.section,
      quiz_id: attempt.quiz_id,
      quiz_title: attempt.quiz_title,
      score: finalScore, // Use recalculated score from points_earned
      total_questions: totalQuestions, // Use actual question count
      total_points: effectiveTotalPoints, // Report actual total points for all assessments
      percentage: finalPercentage, // Use finalPercentage which includes fallback if needed
      // NOTE: correct_answers is for informational display only (count of correct questions)
      // CRITICAL: Scoring MUST use points_earned/score, NOT correct_answers count
      // correct_answers does NOT equal points scored (e.g., 4 correct questions ≠ 0.4 points)
      correct_answers: correctAnswersCount, // Informational only - NOT used for scoring
      questions: questionsWithCode,
      ...(sectionBreakdown.length > 0 && { section_breakdown: sectionBreakdown }),
      cohort_average_percent:
        cohortRow?.avg_pct != null && !Number.isNaN(Number(cohortRow.avg_pct)) ? Number(cohortRow.avg_pct) : null,
      cohort_top_percent:
        cohortRow?.max_pct != null && !Number.isNaN(Number(cohortRow.max_pct)) ? Number(cohortRow.max_pct) : null,
      ...resultsFinalizedFieldsFromAttempt(attempt as Record<string, unknown>),
    }

    console.log("[v0] Returning response with", response.questions.length, "questions")

    return NextResponse.json(response)
  } catch (error) {
    console.error("[v0] Failed to fetch results:", error)
    return NextResponse.json({ error: "Failed to fetch results. Please try again." }, { status: 500 })
  }
}
