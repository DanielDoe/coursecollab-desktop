import { sql } from "@/lib/db"
import {
  assessmentUsesSectionWeightedGrade,
  parseAssessmentSectionConfig,
} from "@/lib/assessment-sections"

export type AttemptScoreScale = {
  /** Score is already on a 0–100 course percentage (section-weighted / mid-semester). */
  scoreIsPercentScale: boolean
  /** Denominator for raw-points attempts; 100 when scoreIsPercentScale. */
  totalPoints: number | null
  quizTotalRawPoints: number | null
}

export function inferAttemptScoreScale(params: {
  score: number
  totalQuestionsField: number
  quizTotalRawPoints: number
  questionCount: number
  assessmentType: string
  sectionConfig: unknown
}): AttemptScoreScale {
  const useSectionWeighting = assessmentUsesSectionWeightedGrade(
    params.assessmentType,
    parseAssessmentSectionConfig(
      params.sectionConfig as Parameters<typeof parseAssessmentSectionConfig>[0],
    ),
  )

  const quizTotalRawPoints = params.quizTotalRawPoints > 0 ? params.quizTotalRawPoints : null

  if (useSectionWeighting || params.totalQuestionsField === 100) {
    return {
      scoreIsPercentScale: true,
      totalPoints: 100,
      quizTotalRawPoints,
    }
  }

  if (quizTotalRawPoints != null) {
    return {
      scoreIsPercentScale: false,
      totalPoints: quizTotalRawPoints,
      quizTotalRawPoints,
    }
  }

  if (params.totalQuestionsField > 0) {
    return {
      scoreIsPercentScale: false,
      totalPoints: params.totalQuestionsField,
      quizTotalRawPoints,
    }
  }

  return { scoreIsPercentScale: false, totalPoints: null, quizTotalRawPoints }
}

export function scoreToDisplayPercentage(
  score: number | null | undefined,
  scale: AttemptScoreScale,
): number | null {
  if (score == null || !Number.isFinite(Number(score))) return null
  const value = Number(score)
  if (scale.scoreIsPercentScale) {
    return Math.round(Math.min(100, Math.max(0, value)) * 100) / 100
  }
  const total = scale.totalPoints
  if (total == null || total <= 0) return null
  return Math.round((Math.max(0, value) / total) * 10000) / 100
}

export function formatScoreForDisplay(
  score: number | null | undefined,
  scale: AttemptScoreScale,
): string {
  if (score == null || !Number.isFinite(Number(score))) return "—"
  const value = Number(score)
  if (scale.scoreIsPercentScale) {
    return `${scoreToDisplayPercentage(value, scale)!.toFixed(1)}%`
  }
  const total = scale.totalPoints
  if (total != null && total > 0) {
    return `${value.toFixed(2)} / ${total} pts`
  }
  return value.toFixed(2)
}

export async function getAttemptScoreScale(attemptId: number): Promise<AttemptScoreScale | null> {
  const rows = await sql`
    SELECT
      qa.score,
      qa.total_questions,
      q.assessment_type,
      q.section_config,
      (SELECT COUNT(*)::int FROM quiz_questions qq WHERE qq.quiz_id = qa.quiz_id) AS question_count,
      (SELECT COALESCE(SUM(COALESCE(qq.max_points, qq.points, 1)), 0)::numeric
       FROM quiz_questions qq WHERE qq.quiz_id = qa.quiz_id) AS quiz_total_points
    FROM quiz_attempts qa
    JOIN quizzes q ON q.id = qa.quiz_id
    WHERE qa.id = ${attemptId} AND qa.deleted_at IS NULL
    LIMIT 1
  `
  const row = rows[0] as
    | {
        score: unknown
        total_questions: unknown
        assessment_type: string
        section_config: unknown
        question_count: number
        quiz_total_points: unknown
      }
    | undefined
  if (!row) return null

  return inferAttemptScoreScale({
    score: Number(row.score) || 0,
    totalQuestionsField: Number(row.total_questions) || 0,
    quizTotalRawPoints: Number(row.quiz_total_points) || 0,
    questionCount: Number(row.question_count) || 0,
    assessmentType: row.assessment_type,
    sectionConfig: row.section_config,
  })
}
