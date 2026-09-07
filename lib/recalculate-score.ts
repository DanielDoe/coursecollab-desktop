import { sql } from "@/lib/db"
import { recordAttemptScoreChange } from "@/lib/attempt-score-history"
import { tryAutoFinalizePerfectScore } from "@/lib/auto-finalize-perfect-scores"
import {
  assessmentUsesSectionWeightedGrade,
  parseAssessmentSectionConfig,
  type SectionConfig,
} from "@/lib/assessment-sections"
import { clearRequiresReviewForAutoGradedAnswers, clearRequiresReviewForEmptyAnswers } from "@/lib/finalize-recalc-cleanup"
import {
  capQuestionPoints,
  buildPerQuestionEffectivePoints,
  computeSectionWeightedScore,
} from "@/lib/section-weighted-attempt-score"
import { resolveSectionQuestionSelectionsForAttempt } from "@/lib/load-section-question-selections"

const RECALC_COOLDOWN_MS = 5000
const recalcCooldownByAttempt = new Map<number, number>()

export type RecalculateScoreResult = {
  success: true
  attemptId: number
  score: number
  totalQuestions: number
  correctCount: number
  actualPointsEarned: number
  totalPossiblePoints: number
  answeredCount: number
  alreadyFinalized: boolean
}

export class RecalculateRateLimitError extends Error {
  retryAfterMs: number
  constructor(retryAfterMs: number) {
    super(`Please wait ${Math.ceil(retryAfterMs / 1000)} seconds before recalculating again.`)
    this.name = "RecalculateRateLimitError"
    this.retryAfterMs = retryAfterMs
  }
}

export type RecalculateScoreOptions = {
  /** When true, finalized attempts may receive a lower score (instructor/formula corrections). */
  allowScoreDecrease?: boolean
}

/**
 * Atomically recalculate an attempt score from stored answers.
 * Rate-limited and row-locked to prevent concurrent recalc races (score manipulation exploit).
 */
export async function recalculateAttemptScore(
  attemptId: number,
  quizId: number,
  options?: RecalculateScoreOptions,
): Promise<RecalculateScoreResult> {
  const now = Date.now()
  const last = recalcCooldownByAttempt.get(attemptId) ?? 0
  if (now - last < RECALC_COOLDOWN_MS) {
    throw new RecalculateRateLimitError(RECALC_COOLDOWN_MS - (now - last))
  }

  const attemptRows = await sql`
    SELECT qa.id, qa.completed_at, qa.is_final_grade, q.assessment_type
    FROM quiz_attempts qa
    JOIN quizzes q ON q.id = qa.quiz_id
    WHERE qa.id = ${attemptId} AND qa.quiz_id = ${quizId} AND qa.deleted_at IS NULL
    LIMIT 1
    FOR UPDATE OF qa
  `

  if (attemptRows.length === 0) {
    throw new Error("Attempt not found")
  }

  const attempt = attemptRows[0]
  const alreadyFinalized = Boolean(attempt.completed_at)

  await clearRequiresReviewForEmptyAnswers(attemptId)
  await clearRequiresReviewForAutoGradedAnswers(attemptId)

  const quizResult = await sql`
    SELECT q.assessment_type, q.section_config, COUNT(qq.id) as total
    FROM quizzes q
    LEFT JOIN quiz_questions qq ON q.id = qq.quiz_id
    WHERE q.id = ${quizId}
    GROUP BY q.assessment_type, q.section_config
  `

  const quizType = quizResult[0]?.assessment_type
  const sectionConfig = parseAssessmentSectionConfig(
    quizResult[0]?.section_config as SectionConfig[] | string | null | undefined,
  )
  const useSectionWeighting = assessmentUsesSectionWeightedGrade(quizType, sectionConfig)
  const totalQuestions = Number(quizResult[0]?.total) || 0

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

  const totalQuizPointsResult = await sql`
    SELECT
      SUM(COALESCE(qq.max_points, qq.points, 1)) as total_quiz_points,
      COUNT(qq.id) as total_question_count
    FROM quiz_questions qq
    WHERE qq.quiz_id = ${quizId}
  `

  let actualPointsEarned = Number(scoreResult[0]?.actual_points_earned) || 0
  const answeredCount = Number(scoreResult[0]?.answered_count) || 0
  const totalQuizPoints = Number(totalQuizPointsResult[0]?.total_quiz_points) || 0
  const actualTotalQuestionCount = Number(totalQuizPointsResult[0]?.total_question_count) || totalQuestions

  const correctCountResult = await sql`
    SELECT COUNT(*) as correct_count
    FROM quiz_answers qa
    WHERE qa.attempt_id = ${attemptId} AND qa.is_correct = true
  `
  const correctCount = Number(correctCountResult[0]?.correct_count) || 0

  let finalScore = actualPointsEarned
  let storedTotalQuestions = actualTotalQuestionCount

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
      attemptId,
      quizId,
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
  } else if (
    ["quiz", "homework", "final"].includes(quizType) &&
    totalQuizPoints > 0 &&
    actualPointsEarned > totalQuizPoints
  ) {
    finalScore = totalQuizPoints
  } else if (quizType === "mid_semester" && totalQuizPoints > 0) {
    const percentage = (actualPointsEarned / totalQuizPoints) * 100
    finalScore = Math.round(percentage * 100) / 100
    storedTotalQuestions = 100
  }

  if (alreadyFinalized) {
    const currentScoreResult = await sql`
      SELECT score FROM quiz_attempts WHERE id = ${attemptId} LIMIT 1
    `
    const currentScore = Number(currentScoreResult[0]?.score ?? 0)

    // Students cannot lower their score via repeated recalculate spam
    if (!options?.allowScoreDecrease && finalScore < currentScore) {
      finalScore = currentScore
    }
  }

  const beforeUpdate = await sql`
    SELECT score FROM quiz_attempts WHERE id = ${attemptId} LIMIT 1
  `
  const previousScore = Number(beforeUpdate[0]?.score ?? 0)

  await sql`
    UPDATE quiz_attempts
    SET
      score = ${finalScore},
      total_questions = ${storedTotalQuestions},
      completed_at = COALESCE(completed_at, NOW()),
      is_final_grade = COALESCE(is_final_grade, true)
    WHERE id = ${attemptId}
  `

  await recordAttemptScoreChange({
    attemptId,
    previousScore,
    newScore: finalScore,
    totalPoints: storedTotalQuestions === 100 ? 100 : totalQuizPoints > 0 ? totalQuizPoints : storedTotalQuestions,
    source: "recalculate",
    actorType: "system",
    reason: alreadyFinalized ? "Score recalculated on finalized attempt" : "Score recalculated from stored answers",
  })

  await tryAutoFinalizePerfectScore(attemptId)

  recalcCooldownByAttempt.set(attemptId, Date.now())

  return {
    success: true,
    attemptId,
    score: finalScore,
    totalQuestions: storedTotalQuestions,
    correctCount,
    actualPointsEarned,
    totalPossiblePoints: totalQuizPoints,
    answeredCount,
    alreadyFinalized,
  }
}
