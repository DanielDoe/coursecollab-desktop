/**
 * Shared Submission Logic
 * 
 * Handles answer submission with retry logic, offline support,
 * and transaction safety for all assessment types.
 */

import { sql } from "@/lib/db"
import { getAssessmentConfig, updateAttemptScore } from "./db"
import { evaluateAssessmentAnswer } from "./evaluate"
import { getQuizQuestionForEvaluateResolved } from "@/lib/resolve-quiz-question-from-bank"
import { reconcileFinalGradeFlagsForStudent } from "@/lib/auto-finalize-quiz-attempts"
import { setResultsFinalized } from "@/lib/results-finalized"
import { resolveSelectAllCorrectLetters } from "@/lib/practice-answer-review"
import type { AssessmentType } from "./db"

export interface SubmitAnswerPayload {
  assessmentType: AssessmentType
  attemptId: number
  questionId: number
  answer: any
  questionType: string
  plotImage?: string
  /** Base URL for evaluate-code API (enables itemized feedback for code questions) */
  baseUrl?: string
  /** Typing replay for code questions (anti-cheat) */
  typingReplay?: { startTime: number; events: Array<{ t: number; op: "i" | "d"; offset: number; text: string; len?: number }> } | null
  /** Seconds spent on this question (for results report) */
  timeSpentSeconds?: number | null
}

export interface SubmitAnswerResult {
  success: boolean
  isCorrect: boolean | null
  pointsEarned: number
  maxPoints: number
  feedback?: string
  requiresReview: boolean
  /** Post-submit only: correct option letters for select_all highlighting (answer key withheld during take). */
  correctLetters?: string[]
  error?: string
}

/**
 * Submit a single answer with retry logic
 */
export async function submitAnswer(
  payload: SubmitAnswerPayload,
  retryCount: number = 0
): Promise<SubmitAnswerResult> {
  const maxRetries = 1
  const { assessmentType, attemptId, questionId, answer, questionType, plotImage, baseUrl, typingReplay, timeSpentSeconds } = payload

    const isCodeType = ["code_write", "code_problem", "debug_code", "code_explain", "code_write_plot", "code_debug"].includes((questionType || "").toLowerCase())
  console.log("[assessment-core/submit] questionType=", questionType, "isCodeType=", isCodeType, "baseUrl=", baseUrl?.slice(0, 50))
  if (isCodeType) {
    console.log("[assessment-core/submit] [TYPING-REPLAY]", {
      attemptId,
      questionId,
      hasReplay: !!typingReplay,
      eventCount: typingReplay?.events?.length ?? 0,
    })
  }

  try {
    // Get question details
    const question = await getQuizQuestionForEvaluateResolved(questionId)

    if (!question) {
      return {
        success: false,
        isCorrect: null,
        pointsEarned: 0,
        maxPoints: 1,
        requiresReview: false,
        error: "Question not found"
      }
    }

    const maxPoints = Number(question.effective_max_points) || 1

    // Evaluate answer (baseUrl enables evaluate-code API for itemized feedback)
    console.log("[assessment-core/submit] Calling evaluateAssessmentAnswer")
    const evaluation = await evaluateAssessmentAnswer({
      assessmentType,
      attemptId,
      questionId,
      question,
      studentAnswer: answer,
      questionType,
      maxPoints,
      plotImage,
      aiEvaluationMode: question.ai_evaluation_mode || 'standard',
      codeLanguage: (question as { code_language?: string }).code_language || 'cpp',
      baseUrl,
      typingReplay,
      timeSpentSeconds,
    })

    // Update attempt score
    await updateAttemptTotalScore(assessmentType, attemptId)

    const qt = (questionType || "").toLowerCase()
    const correctLetters =
      qt === "select_all" || qt === "multi_output"
        ? resolveSelectAllCorrectLetters({
            option_a: question.option_a,
            option_b: question.option_b,
            option_c: question.option_c,
            option_d: question.option_d,
            option_e: question.option_e,
            correct_answer: question.correct_answer,
          })
        : undefined

    return {
      success: true,
      isCorrect: evaluation.isCorrect,
      pointsEarned: evaluation.pointsEarned,
      maxPoints,
      feedback: evaluation.feedback || undefined,
      requiresReview: evaluation.requiresReview,
      correctLetters: correctLetters?.length ? correctLetters : undefined,
    }
  } catch (error: any) {
    console.error(`[assessment-core/submit] Attempt ${retryCount + 1}/${maxRetries} failed:`, error?.message, error?.stack)

    // Retry on network/database errors
    if (retryCount < maxRetries && (
      error.message?.includes('fetch') ||
      error.message?.includes('network') ||
      error.message?.includes('timeout') ||
      error.code === 'ECONNREFUSED'
    )) {
      const delay = Math.min(1000 * Math.pow(2, retryCount), 5000) // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, delay))
      return submitAnswer(payload, retryCount + 1)
    }

    return {
      success: false,
      isCorrect: null,
      pointsEarned: 0,
      maxPoints: 1,
      requiresReview: false,
      error: error.message || "Failed to submit answer"
    }
  }
}

/**
 * Update total score for an attempt
 */
async function updateAttemptTotalScore(
  assessmentType: AssessmentType,
  attemptId: number
) {
  const config = getAssessmentConfig(assessmentType)

  // Calculate total score from all answers
  const scoreResults = await sql`
    SELECT 
      COUNT(*) as total_questions,
      SUM(points_earned) as total_points
    FROM ${sql.unsafe(config.answersTable)}
    WHERE attempt_id = ${attemptId}
  `

  const totalQuestions = Number(scoreResults[0]?.total_questions) || 0
  const totalPoints = Number(scoreResults[0]?.total_points) || 0

  // Get correct answer count for score calculation
  const correctCounts = await sql`
    SELECT COUNT(*) as count
    FROM ${sql.unsafe(config.answersTable)}
    WHERE attempt_id = ${attemptId} AND is_correct = true
  `

  const score = Number(correctCounts[0]?.count) || 0

  await updateAttemptScore(assessmentType, attemptId, score, totalQuestions)
}

/**
 * Submit multiple answers in batch
 */
export async function submitAnswers(
  payloads: SubmitAnswerPayload[]
): Promise<SubmitAnswerResult[]> {
  const results = await Promise.all(
    payloads.map(payload => submitAnswer(payload))
  )
  
  return results
}

/**
 * Finalize assessment attempt
 */
export async function finalizeAttempt(
  assessmentType: AssessmentType,
  attemptId: number,
  completedAt?: Date
) {
  const config = getAssessmentConfig(assessmentType)

  // Update final score
  await updateAttemptTotalScore(assessmentType, attemptId)

  // Mark as completed — use NOW() so Postgres never sees JS Date strings like "GMT-0500".
  await sql`
    UPDATE ${sql.unsafe(config.attemptsTable)}
    SET completed_at = NOW()
    WHERE id = ${attemptId}
  `

  // Update final grade flags based on retake policy
  const attempts = await sql`
    SELECT ${sql.unsafe(config.idColumn)} as assessment_id, student_id
    FROM ${sql.unsafe(config.attemptsTable)}
    WHERE id = ${attemptId}
  `
  const attempt = attempts[0]

  if (attempt) {
    await reconcileFinalGradeFlagsForStudent(
      Number(attempt.assessment_id),
      Number(attempt.student_id),
    )
    try {
      await setResultsFinalized(attemptId, true, "submit")
    } catch {
      // non-fatal
    }
  }
}

export async function reconcileStudentFinalGradeFlags(
  _assessmentType: AssessmentType,
  assessmentId: number,
  studentId: number,
) {
  await reconcileFinalGradeFlagsForStudent(assessmentId, studentId)
}

