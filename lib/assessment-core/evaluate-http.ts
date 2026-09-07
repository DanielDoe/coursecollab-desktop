/**
 * Shared HTTP evaluate handler for /api/[assessmentType]/evaluate and legacy /api/quiz/evaluate.
 * Routes circuit_submission (vision AI), multi_part, and other core-pipeline types through
 * evaluateAssessmentAnswer — never through legacy MCQ string compare.
 */
import { sql } from "@/lib/db"
import { evaluateAssessmentAnswer } from "@/lib/assessment-core/evaluate"
import { formatEvaluateApiResponse } from "@/lib/assessment-core/format-evaluate-api-response"
import type { AssessmentType } from "@/lib/assessment-core/db"
import {
  deriveMultiPartGradingPolicy,
  usesStandardMultiPartGradingPolicy,
} from "@/lib/multi-part-grading-policy"
import { getQuizQuestionForEvaluateResolved } from "@/lib/resolve-quiz-question-from-bank"
import {
  isRegularAssessmentTypeForSemesterCutoff,
  regularAssessmentsClosedMessage,
} from "@/lib/regular-assessments-cutoff"
import { isRegularAssessmentSemesterHardCloseBlockingStudent } from "@/lib/retake-access"
import { canVerifyLocally } from "@/lib/local-answer-verification"

/** Question types graded by AI / vision through evaluateAssessmentAnswer. */
export const ASSESSMENT_CORE_EVAL_TYPES = new Set([
  "multi_part",
  "circuit_submission",
  "circuit_upload_work",
  "circuit_worked_solution",
  "circuit_diagram_analysis",
  "circuit_transfer_function",
  "circuit_phasor_power",
  "circuit_transient_response",
])

/** Auto-graded from stored answer keys (never AI). */
export const AUTO_KEY_EVAL_QUESTION_TYPES = new Set([
  "mcq",
  "true_false",
  "select_all",
  "multi_output",
  "fill_blank",
  "code_output",
  "trace_output",
])

const AI_CODE_EVAL_TYPES = new Set([
  "code_write",
  "code_explain",
  "code_problem",
  "debug_code",
  "code_debug",
  "code_write_plot",
])

export function isAssessmentCoreEvalType(questionType: string | null | undefined): boolean {
  return ASSESSMENT_CORE_EVAL_TYPES.has((questionType || "").toLowerCase())
}

/** Types supported by /api/[assessmentType]/evaluate → evaluateAssessmentAnswer. */
export function canUseAssessmentCoreEvaluatePipeline(
  questionType: string | null | undefined,
): boolean {
  const qt = (questionType || "").toLowerCase()
  if (!qt) return false
  if (isAssessmentCoreEvalType(qt)) return true
  if (AUTO_KEY_EVAL_QUESTION_TYPES.has(qt)) return true
  if (canVerifyLocally(qt)) return true
  if (AI_CODE_EVAL_TYPES.has(qt)) return true
  return false
}

export class AssessmentEvaluateHttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = "AssessmentEvaluateHttpError"
  }
}

export type AssessmentCoreEvaluateInput = {
  assessmentType: AssessmentType
  questionId: number
  answer: unknown
  questionType?: string
  attemptId: number
  plotImage?: string
  typingReplay?: {
    startTime: number
    events: Array<{ t: number; op: "i" | "d"; offset: number; text: string; len?: number }>
  }
}

export async function buildAssessmentCoreEvaluateResponse(input: AssessmentCoreEvaluateInput) {
  const question = await getQuizQuestionForEvaluateResolved(input.questionId)
  if (!question) {
    throw new AssessmentEvaluateHttpError(404, "Question not found")
  }

  const qType = (question as { quiz_assessment_type?: string }).quiz_assessment_type
  if (isRegularAssessmentTypeForSemesterCutoff(qType)) {
    const attemptOwner = await sql`
      SELECT student_id FROM quiz_attempts WHERE id = ${input.attemptId} AND deleted_at IS NULL LIMIT 1
    `
    const ownerId = Number(attemptOwner[0]?.student_id) || 0
    if (
      ownerId > 0 &&
      (await isRegularAssessmentSemesterHardCloseBlockingStudent(ownerId))
    ) {
      throw new AssessmentEvaluateHttpError(403, regularAssessmentsClosedMessage())
    }
  }

  const qtLower = (input.questionType || question.question_type || "").toLowerCase()
  if (!canUseAssessmentCoreEvaluatePipeline(qtLower)) {
    throw new AssessmentEvaluateHttpError(
      400,
      `Question type "${qtLower}" is not handled by the assessment core evaluate pipeline`,
    )
  }

  let maxPoints = Number(question.effective_max_points) || 1
  if (
    qtLower === "multi_part" &&
    usesStandardMultiPartGradingPolicy(question.solution_upload_config, qtLower)
  ) {
    maxPoints = deriveMultiPartGradingPolicy(
      question.subquestions,
      question.solution_upload_config,
    ).total_points
  }

  let answerData: unknown
  if (qtLower === "circuit_submission") {
    const existing = await sql`
      SELECT answer_data
      FROM quiz_answers
      WHERE attempt_id = ${input.attemptId} AND question_id = ${input.questionId}
      ORDER BY id DESC
      LIMIT 1
    `
    if (existing[0]?.answer_data != null) {
      answerData = existing[0].answer_data
    }
  }

  const result = await evaluateAssessmentAnswer({
    assessmentType: input.assessmentType,
    attemptId: input.attemptId,
    questionId: input.questionId,
    question,
    studentAnswer: input.answer,
    questionType: qtLower,
    maxPoints,
    plotImage: input.plotImage,
    typingReplay: input.typingReplay,
    aiEvaluationMode: question.ai_evaluation_mode || "standard",
    codeLanguage: question.code_language || "cpp",
    answerData,
  })

  const aiFeedback = (result as { aiFeedback?: Record<string, unknown> }).aiFeedback

  return formatEvaluateApiResponse({
    result: {
      isCorrect: result.isCorrect,
      points: result.points,
      pointsEarned: result.pointsEarned,
      feedback: result.feedback,
      requiresReview: result.requiresReview,
    },
    aiFeedback: aiFeedback ?? null,
    questionType: qtLower,
    maxPoints,
  })
}
