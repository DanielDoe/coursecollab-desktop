/**
 * Circuit submission grading: AI vision first, instructor override later.
 * Student submissions receive provisional AI scores pending instructor approval.
 */

import type { EvaluationResult } from "@/lib/evaluation"
import { evaluateCircuitSubmissionUpload } from "@/lib/ai-evaluate-circuit-submission"
import {
  circuitSubmissionFileCount,
  mergeCircuitSubmissionGrading,
  parseCircuitSubmissionAnswer,
  parseCircuitSubmissionConfig,
  resolveCircuitSubmissionForGrading,
  sumCircuitSubmissionRubricScores,
  type CircuitSubmissionAnswer,
  type CircuitSubmissionGradingOutcome,
} from "@/lib/circuit-submission"
import { workspaceHasContent } from "@/lib/circuit-workspace"
import { resolveReferenceAnswerForAiGrading } from "@/lib/resolve-reference-answer-for-ai"
import { exportCircuitWorkspaceUploadsServer } from "@/lib/circuit-workspace-export-server"
import { sql } from "@/lib/db"

const CIRCUIT_VISION_TECHNICAL_ERRORS = new Set([
  "missing_api_key",
  "no_vision_assets",
  "api_error",
  "parse_error",
  "ai_failed",
])

function circuitVisionTechnicalFailure(errorType?: string): boolean {
  return Boolean(errorType && CIRCUIT_VISION_TECHNICAL_ERRORS.has(errorType))
}

function circuitVisionGradingSucceeded(ai: {
  errorType?: string
  feedback: string
}): boolean {
  return !circuitVisionTechnicalFailure(ai.errorType) && Boolean(ai.feedback?.trim())
}

type CircuitAiEval = Awaited<ReturnType<typeof evaluateCircuitSubmissionUpload>>

function buildFinalizedCircuitResult(
  parsed: CircuitSubmissionAnswer,
  ai: CircuitAiEval,
  maxPoints: number,
  hasRubric: boolean,
  expectedAnswerUsed: boolean,
): GradeCircuitSubmissionResult {
  const merged = mergeCircuitSubmissionGrading(parsed, {
    manual_score: ai.totalScore,
    instructor_feedback: ai.feedback,
    rubric_scores: hasRubric ? ai.rubricScores : null,
    graded_by: "ai",
    graded_at: new Date().toISOString(),
    submission_status: "graded",
  })
  const overallPercent =
    maxPoints > 0 ? Math.round((ai.totalScore / maxPoints) * 10000) / 100 : 0

  return {
    result: {
      isCorrect: ai.totalScore >= maxPoints * 0.5,
      points: overallPercent,
      feedback: ai.feedback,
      requiresReview: false,
    },
    pointsEarned: ai.totalScore,
    requiresReview: false,
    aiFeedback: {
      aiGraded: true,
      circuitSubmissionAiGraded: true,
      gradingOutcome: "graded",
      rubricScores: ai.rubricScores,
      totalScore: ai.totalScore,
      maxPoints,
      score: overallPercent,
      feedback: ai.feedback,
      strengths: ai.strengths,
      improvements: ai.improvements,
      confidence: ai.confidence,
      canAutoGrade: ai.canAutoGrade,
      requiresManualReview: false,
      expectedAnswerUsed,
      evaluatedAt: new Date().toISOString(),
      questionType: "circuit_submission",
      minimumFloorApplied: ai.minimumFloorApplied === true,
      submissionViable: ai.submissionViable,
    },
    mergedAnswer: merged,
  }
}

function buildProvisionalCircuitResult(
  parsed: CircuitSubmissionAnswer,
  ai: CircuitAiEval,
  maxPoints: number,
  hasRubric: boolean,
  expectedAnswerUsed: boolean,
): GradeCircuitSubmissionResult {
  const merged = mergeCircuitSubmissionGrading(parsed, {
    instructor_feedback: ai.feedback,
    rubric_scores: hasRubric ? ai.rubricScores : null,
    submission_status: "submitted",
  })
  const overallPercent =
    maxPoints > 0 ? Math.round((ai.totalScore / maxPoints) * 10000) / 100 : 0

  return {
    result: {
      isCorrect: false,
      points: 0,
      feedback: ai.feedback,
      requiresReview: true,
    },
    pointsEarned: 0,
    requiresReview: true,
    aiFeedback: {
      aiGraded: true,
      circuitSubmissionAiGraded: false,
      provisionalScore: true,
      requiresInstructorApproval: true,
      gradingOutcome: "instructor_review",
      rubricScoresPreview: ai.rubricScores,
      totalScorePreview: ai.totalScore,
      maxPoints,
      score: overallPercent,
      feedback: ai.feedback,
      strengths: ai.strengths,
      improvements: ai.improvements,
      confidence: ai.confidence,
      canAutoGrade: ai.canAutoGrade,
      requiresManualReview: true,
      expectedAnswerUsed,
      evaluatedAt: new Date().toISOString(),
      questionType: "circuit_submission",
      minimumFloorApplied: ai.minimumFloorApplied === true,
      submissionViable: ai.submissionViable,
    },
    mergedAnswer: merged,
  }
}

export type GradeCircuitSubmissionResult = {
  result: EvaluationResult
  pointsEarned: number
  requiresReview: boolean
  aiFeedback: Record<string, unknown> | null
  mergedAnswer: CircuitSubmissionAnswer
}

async function ensureWorkspaceExportedForGrading(
  parsed: CircuitSubmissionAnswer,
  options?: {
    attemptId?: number
    questionId?: number
    studentDatabaseId?: number
    questionTitle?: string
  },
): Promise<CircuitSubmissionAnswer> {
  const uploads = parsed.solution_uploads ?? {}
  if (circuitSubmissionFileCount(uploads) > 0) return parsed
  if (parsed.submission_mode !== "workspace" || !workspaceHasContent(parsed.workspace) || !parsed.workspace) {
    return parsed
  }
  const attemptId = options?.attemptId
  const questionId = options?.questionId
  if (!attemptId || !questionId) return parsed

  let studentDatabaseId = options?.studentDatabaseId
  if (!studentDatabaseId) {
    const [row] = await sql`
      SELECT student_id FROM quiz_attempts WHERE id = ${attemptId} LIMIT 1
    `
    studentDatabaseId = row ? Number((row as { student_id: number }).student_id) : undefined
  }
  if (!studentDatabaseId || !Number.isFinite(studentDatabaseId)) return parsed

  try {
    const exported = await exportCircuitWorkspaceUploadsServer({
      workspace: parsed.workspace,
      attemptId,
      questionId,
      studentDatabaseId,
      title: options?.questionTitle,
    })
    if (Object.keys(exported).length === 0) return parsed
    return {
      ...parsed,
      solution_uploads: exported,
      submission_status: parsed.submission_status === "not_started" ? "submitted" : parsed.submission_status,
    }
  } catch (e) {
    console.error("[gradeCircuitSubmission] workspace server export failed:", e)
    return parsed
  }
}

export async function gradeCircuitSubmissionAnswer(
  question: {
    question_text?: string
    question_media?: unknown
    solution_upload_config?: unknown
    expected_answer?: string | null
    hint?: string | null
    title?: string | null
  },
  studentAnswer: unknown,
  options?: {
    aiEvaluationMode?: string
    maxPoints?: number
    answerData?: unknown
    aiModel?: string | null
    aiModelByTask?: unknown
    aiEnableOpusFallback?: boolean | null
    aiOpusConfidenceThreshold?: number | null
    /** Faculty re-eval / on-behalf recovery — persist AI rubric scores as official points. */
    instructorInitiated?: boolean
    /** When workspace ink exists but PNGs were never exported, render and upload server-side. */
    attemptId?: number
    questionId?: number
    studentDatabaseId?: number
    questionTitle?: string
  },
): Promise<GradeCircuitSubmissionResult> {
  const maxPoints = Math.max(0, Number(options?.maxPoints) || 10)
  let parsed =
    options?.answerData != null
      ? resolveCircuitSubmissionForGrading(studentAnswer, options.answerData)
      : parseCircuitSubmissionAnswer(studentAnswer)

  parsed = await ensureWorkspaceExportedForGrading(parsed, options)

  const uploads = parsed.solution_uploads ?? {}
  const hasUpload = circuitSubmissionFileCount(uploads) > 0

  const pendingResult = (
    feedback: string,
    outcome: CircuitSubmissionGradingOutcome,
  ): GradeCircuitSubmissionResult => ({
    result: {
      isCorrect: false,
      points: 0,
      feedback,
      requiresReview: outcome === "evaluation_failed" || outcome === "instructor_review",
    },
    pointsEarned: 0,
    requiresReview: outcome === "evaluation_failed" || outcome === "instructor_review",
    aiFeedback: {
      aiGraded: outcome === "missing_submission",
      requiresManualReview: outcome === "evaluation_failed" || outcome === "instructor_review",
      gradingOutcome: outcome,
      questionType: "circuit_submission",
      evaluatedAt: new Date().toISOString(),
    },
    mergedAnswer: {
      ...parsed,
      submission_status: hasUpload ? "submitted" : "not_started",
    },
  })

  if (!hasUpload) {
    const wsOnly =
      parsed.submission_mode === "workspace" && workspaceHasContent(parsed.workspace)
    return pendingResult(
      wsOnly
        ? "Workspace solution was not exported as images. Open the question, tap Save to submission, then submit again (or ask your instructor to re-evaluate after you re-save)."
        : "No solution uploaded. Upload at least one file before submitting.",
      "missing_submission",
    )
  }

  const ai = await evaluateCircuitSubmissionUpload({
    questionText: question.question_text || "",
    expectedAnswer: resolveReferenceAnswerForAiGrading(question),
    questionMedia: question.question_media,
    solutionUploads: uploads,
    solutionUploadConfig: question.solution_upload_config,
    maxPoints,
    aiEvaluationMode: options?.aiEvaluationMode,
    aiModel: options?.aiModel,
    aiModelByTask: options?.aiModelByTask,
    aiEnableOpusFallback: options?.aiEnableOpusFallback,
    aiOpusConfidenceThreshold: options?.aiOpusConfidenceThreshold,
  })

  const config = parseCircuitSubmissionConfig(question.solution_upload_config)
  const hasRubric = config.rubric != null
  const visionOk = circuitVisionGradingSucceeded(ai)
  const instructorInitiated = options?.instructorInitiated === true
  const expectedAnswerUsed = Boolean(question.expected_answer?.trim())

  if (
    instructorInitiated &&
    visionOk &&
    Boolean(ai.feedback?.trim()) &&
    !circuitVisionTechnicalFailure(ai.errorType)
  ) {
    return buildFinalizedCircuitResult(parsed, ai, maxPoints, hasRubric, expectedAnswerUsed)
  }

  if (visionOk) {
    return buildProvisionalCircuitResult(parsed, ai, maxPoints, hasRubric, expectedAnswerUsed)
  }

  const failedOutcome: CircuitSubmissionGradingOutcome = circuitVisionTechnicalFailure(ai.errorType)
    ? "evaluation_failed"
    : "instructor_review"

  const merged = mergeCircuitSubmissionGrading(parsed, {
    instructor_feedback: ai.feedback || null,
    rubric_scores: hasRubric ? ai.rubricScores : null,
    submission_status: "submitted",
  })

  const reviewMsg =
    ai.feedback ||
    (failedOutcome === "evaluation_failed"
      ? "AI could not grade your upload automatically. Your instructor will review it manually."
      : "Your instructor will complete grading.")

  return {
    result: {
      isCorrect: false,
      points: 0,
      feedback:
        failedOutcome === "evaluation_failed"
          ? reviewMsg
          : `Your solution upload is pending instructor review (up to ${maxPoints} pts).\n\n${reviewMsg}`,
      requiresReview: true,
    },
    pointsEarned: 0,
    requiresReview: true,
    aiFeedback: {
      aiGraded: false,
      circuitSubmissionAiGraded: false,
      gradingOutcome: failedOutcome,
      rubricScoresPreview: ai.rubricScores,
      totalScorePreview: ai.totalScore,
      maxPoints,
      feedback: ai.feedback,
      strengths: ai.strengths,
      improvements: ai.improvements,
      confidence: ai.confidence,
      canAutoGrade: ai.canAutoGrade,
      requiresManualReview: true,
      errorType: ai.errorType,
      technicalError: ai.technicalError,
      evaluatedAt: new Date().toISOString(),
      questionType: "circuit_submission",
    },
    mergedAnswer: merged,
  }
}
