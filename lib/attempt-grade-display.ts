/**
 * Shared logic for computing display score/percentage for an attempt.
 * Used by email-grades-updated and must match instructor/student results view.
 * Handles: section-weighted scoring (I, II, III), override_points, mid-semester/finals.
 */
import { sql } from "@/lib/db"
import {
  calculateWeightedScore,
  assessmentUsesSectionWeightedGrade,
  parseAssessmentSectionConfig,
  type SectionConfig,
} from "@/lib/assessment-sections"
import { computeSectionScoreRows } from "@/lib/section-weighted-attempt-score"
import { resolveSectionQuestionSelectionsForAttempt } from "@/lib/load-section-question-selections"

export interface AttemptDisplayGrade {
  score: number
  totalPoints: number
  percentage: number
  assessmentType: string
}

/**
 * Get the display grade for an attempt - matches what instructor/student see.
 * Recalculates from quiz_answers (respects override_points, manual grading).
 */
export async function getAttemptDisplayGrade(
  attemptId: string
): Promise<AttemptDisplayGrade | null> {
  const attemptIdNum = parseInt(String(attemptId), 10)
  if (isNaN(attemptIdNum)) return null

  const attemptResult = await sql`
    SELECT qa.id, qa.quiz_id, qa.score, qa.total_score_override, q.assessment_type, q.section_config
    FROM quiz_attempts qa
    JOIN quizzes q ON qa.quiz_id = q.id
    WHERE qa.id = ${attemptIdNum} AND qa.deleted_at IS NULL
    LIMIT 1
  `
  if (attemptResult.length === 0) return null

  const attempt = attemptResult[0] as {
    quiz_id: number
    score: number
    total_score_override: unknown
    assessment_type: string
    section_config: SectionConfig[] | null
  }

  const at = String(attempt.assessment_type ?? "").toLowerCase().trim()
  const isMidSemester = at === "mid_semester" || at === "midsem"
  // Recalculate actual score from quiz_answers (respects override_points, manual grading)
  const actualScoreResult = await sql`
    WITH unique_answers AS (
      SELECT DISTINCT ON (qa.question_id)
        qa.question_id,
        LEAST(
          COALESCE(qa.override_points, qa.points_earned, 0),
          COALESCE(qq.max_points, qq.points, 1)
        ) as effective_points
      FROM quiz_answers qa
      INNER JOIN quiz_questions qq ON qq.id = qa.question_id AND qq.quiz_id = ${attempt.quiz_id}
      WHERE qa.attempt_id = ${attemptIdNum}
      ORDER BY qa.question_id, COALESCE(qa.override_points, qa.points_earned) DESC NULLS LAST
    )
    SELECT COALESCE(SUM(ua.effective_points), 0) as actual_score
    FROM unique_answers ua
  `
  const actualScore = parseFloat(actualScoreResult[0]?.actual_score || 0)
  const storedScore = parseFloat(String(attempt.score ?? 0))

  // Total points from quiz_questions
  const totalPointsResult = await sql`
    SELECT COALESCE(SUM(COALESCE(max_points, points, 1)), 0) as total_points
    FROM quiz_questions WHERE quiz_id = ${attempt.quiz_id}
  `
  const totalPossiblePoints = Math.max(
    1,
    parseFloat(String(totalPointsResult[0]?.total_points || 1))
  )

  // Use recalculated score; fallback to stored when no answers
  let finalScore = actualScore > 0 ? actualScore : storedScore
  if (totalPossiblePoints > 0 && storedScore > totalPossiblePoints) {
    finalScore = actualScore
  }
  if (totalPossiblePoints > 0 && finalScore > totalPossiblePoints) {
    finalScore = totalPossiblePoints
  }

  const sectionConfig = parseAssessmentSectionConfig(
    attempt.section_config as SectionConfig[] | string | null | undefined,
  )
  const useSectionWeighting = assessmentUsesSectionWeightedGrade(at, sectionConfig)

  let percentage = 0
  let displayScore = finalScore
  let displayTotalPoints = totalPossiblePoints

  if (useSectionWeighting) {
    const scoreBreakdownRaw = await sql`
      SELECT DISTINCT ON (qq.id)
        qq.id, qq.question_type, qq.question_order,
        LEAST(
          COALESCE(qa.override_points, qa.points_earned, 0),
          COALESCE(qq.max_points, qq.points, 1)
        ) as points_earned,
        COALESCE(qq.max_points, qq.points, 1) as max_points,
        (qa.id IS NOT NULL) as has_answer
      FROM quiz_questions qq
      LEFT JOIN quiz_answers qa ON qa.question_id = qq.id AND qa.attempt_id = ${attemptIdNum}
      WHERE qq.quiz_id = ${attempt.quiz_id}
      ORDER BY qq.id, COALESCE(qa.override_points, qa.points_earned) DESC NULLS LAST
    `
    const rows = scoreBreakdownRaw as Array<{
      id: number
      question_type: string
      question_order: number
      points_earned: number
      max_points: number
      has_answer: boolean
    }>
    rows.sort((a, b) => (a.question_order ?? 999) - (b.question_order ?? 999))
    const sectionQuestionSelections = await resolveSectionQuestionSelectionsForAttempt(
      attemptIdNum,
      attempt.quiz_id,
      sectionConfig,
    )
    const perQuestion = rows.map((q) => ({
      max_points: Number(q.max_points ?? 1),
      effective_points: Number(q.points_earned ?? 0),
      answered: q.has_answer === true,
    }))
    const answeredQuestionIds = new Set(
      rows.filter((q) => q.has_answer).map((q) => q.id),
    )
    const sectionScores = computeSectionScoreRows(
      rows.map((q) => ({ question_type: q.question_type, id: q.id })),
      perQuestion,
      sectionConfig,
      { sectionQuestionSelections, answeredQuestionIds },
    )
    percentage = Math.max(
      0,
      Math.min(100, Math.round(calculateWeightedScore(sectionScores) * 10) / 10)
    )
    displayScore = percentage
    displayTotalPoints = 100
  } else {
    percentage =
      totalPossiblePoints > 0
        ? Math.max(
            0,
            Math.min(
              100,
              Math.round((finalScore / totalPossiblePoints) * 1000) / 10
            )
          )
        : 0
  }

  // Mid-semester: some systems store score as 0-100%; if computed >100% use stored
  if (
    isMidSemester &&
    storedScore > 0 &&
    storedScore <= 100 &&
    percentage > 100
  ) {
    percentage = Math.max(0, Math.min(100, Math.round(storedScore * 10) / 10))
    if (useSectionWeighting) {
      displayScore = percentage
    }
  }

  // Instructor total-score override (0–100 weighted % or raw); matches results API.
  const ovRaw = attempt.total_score_override
  if (
    !(ovRaw === null || ovRaw === undefined || ovRaw === "") &&
    Number.isFinite(Number(ovRaw))
  ) {
    const ov = Number(ovRaw)
    if (useSectionWeighting) {
      const capped = Math.min(100, Math.max(0, Math.round(ov * 100) / 100))
      percentage = capped
      displayScore = capped
      displayTotalPoints = 100
    } else if (isMidSemester) {
      const pct = Math.min(100, Math.max(0, Math.round(ov * 100) / 100))
      percentage = pct
      displayTotalPoints = totalPossiblePoints
      displayScore =
        totalPossiblePoints > 0
          ? Math.round((pct / 100) * totalPossiblePoints * 100) / 100
          : 0
    } else {
      const cap = totalPossiblePoints > 0 ? totalPossiblePoints : ov
      const raw = Math.min(Math.max(0, ov), cap)
      displayScore = raw
      displayTotalPoints = totalPossiblePoints
      percentage =
        totalPossiblePoints > 0
          ? Math.max(
              0,
              Math.min(
                100,
                Math.round((raw / totalPossiblePoints) * 1000) / 10,
              ),
            )
          : 0
    }
  }

  return {
    score: displayScore,
    totalPoints: displayTotalPoints,
    percentage,
    assessmentType: attempt.assessment_type || "quiz",
  }
}

/** Stored `quiz_attempts.score` value that matches display (0–100 for section-weighted / mid-semester). */
export function storedScoreFromDisplayGrade(grade: AttemptDisplayGrade): number {
  return grade.totalPoints === 100 ? grade.percentage : grade.score
}

/**
 * Resolve display grades for many attempts (matches results report / instructor view).
 */
export async function getAttemptDisplayGradesBatch(
  attemptIds: number[],
): Promise<Map<number, AttemptDisplayGrade>> {
  const unique = [...new Set(attemptIds.filter((id) => Number.isFinite(id) && id > 0))]
  const map = new Map<number, AttemptDisplayGrade>()
  const chunkSize = 25
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize)
    const results = await Promise.all(
      chunk.map(async (id) => ({ id, grade: await getAttemptDisplayGrade(String(id)) })),
    )
    for (const { id, grade } of results) {
      if (grade) map.set(id, grade)
    }
  }
  return map
}
