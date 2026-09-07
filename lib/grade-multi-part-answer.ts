/**
 * Shared multi-part grading: MCQ (local) + optional AI upload grading.
 */

import type { EvaluationResult } from "@/lib/evaluation"
import { evaluateMultiPartSolutionUpload } from "@/lib/ai-evaluate-multi-part-solution"
import {
  buildMultiPartGradingBreakdown,
  computeMcqPointsEarned,
  computeNormalizedMcqPercent,
  deriveMultiPartGradingPolicy,
  multiPartGradingBreakdownToAnswerData,
  SOLUTION_UPLOAD_PART_KEY,
  usesStandardMultiPartGradingPolicy,
  type MultiPartGradingBreakdown,
} from "@/lib/multi-part-grading-policy"
import {
  hasSolutionUploadForPart,
  unwrapStudentAnswerForGrading,
} from "@/lib/solution-upload"
import { resolveReferenceAnswerForAiGrading } from "@/lib/resolve-reference-answer-for-ai"

export type GradeMultiPartAnswerResult = {
  result: EvaluationResult
  pointsEarned: number
  requiresReview: boolean
  breakdown: MultiPartGradingBreakdown
  aiFeedback: Record<string, unknown> | null
  answerDataExtras: Record<string, unknown>
  maxPointsForQuestion: number
}

export async function gradeMultiPartAnswer(
  question: {
    subquestions?: unknown
    solution_upload_config?: unknown
    question_text?: string
    question_media?: unknown
    circuit_spec?: unknown
    sample_answer?: string | null
    expected_answer?: string | null
    answer_guidelines?: string | null
  },
  studentAnswer: unknown,
  options?: {
    aiEvaluationMode?: string
    questionMaxPoints?: number
    aiModel?: string | null
    aiModelByTask?: unknown
    aiEnableOpusFallback?: boolean | null
    aiOpusConfidenceThreshold?: number | null
  },
): Promise<GradeMultiPartAnswerResult | null> {
  if (!usesStandardMultiPartGradingPolicy(question.solution_upload_config, "multi_part")) {
    return null
  }

  const policy = deriveMultiPartGradingPolicy(question.subquestions, question.solution_upload_config)
  const maxPointsForQuestion = policy.total_points
  const { percent } = computeNormalizedMcqPercent(question.subquestions, studentAnswer)
  const mcqEarned = computeMcqPointsEarned(policy, question.subquestions, studentAnswer)
  const { solutionUploads: uploads } = unwrapStudentAnswerForGrading(studentAnswer, "multi_part")
  const hasUpload = hasSolutionUploadForPart(uploads, SOLUTION_UPLOAD_PART_KEY)

  let uploadEarned: number | null = null
  let uploadPending = hasUpload && policy.manual_grading_required
  let requiresReview = uploadPending
  let aiFeedback: Record<string, unknown> | null = null
  let uploadFeedback = ""
  let aiResult: Awaited<ReturnType<typeof evaluateMultiPartSolutionUpload>> | null = null

  if (hasUpload && policy.upload_total_points > 0) {
    const ai = await evaluateMultiPartSolutionUpload({
      questionText: question.question_text || "",
      subquestionsRaw: question.subquestions,
      questionMedia: question.question_media,
      circuitSpec: question.circuit_spec,
      studentAnswer,
      solutionUploads: uploads,
      uploadMaxPoints: policy.upload_total_points,
      mcqEarned,
      mcqMaxPoints: policy.mcq_total_points,
      aiEvaluationMode: options?.aiEvaluationMode,
      sampleAnswer: resolveReferenceAnswerForAiGrading(question),
      expectedAnswer: question.expected_answer,
      answerGuidelines: question.answer_guidelines,
      aiModel: options?.aiModel,
      aiModelByTask: options?.aiModelByTask,
      aiEnableOpusFallback: options?.aiEnableOpusFallback,
      aiOpusConfidenceThreshold: options?.aiOpusConfidenceThreshold,
    })

    aiResult = ai
    uploadFeedback = ai.feedback
    const aiFinalizedUpload = ai.aiGraded && !ai.requiresManualReview

    if (aiFinalizedUpload) {
      uploadEarned = ai.uploadPointsEarned
      uploadPending = false
      requiresReview = false
    } else {
      uploadEarned = null
      uploadPending = true
      requiresReview = true
    }
  }

  const breakdown = buildMultiPartGradingBreakdown(
    policy,
    question.subquestions,
    studentAnswer,
    uploadEarned,
    uploadPending,
  )

  const pointsEarned = breakdown.total_earned
  const overallPercent =
    breakdown.total_max > 0
      ? Math.round((breakdown.total_earned / breakdown.total_max) * 10000) / 100
      : percent

  let feedback: string
  if (hasUpload) {
    if (uploadPending) {
      feedback = `MCQ: ${mcqEarned.toFixed(2)}/${policy.mcq_total_points} pts. Uploaded solution: pending review (up to ${policy.upload_total_points} pts). Re-evaluate or wait for your instructor.`
      if (uploadFeedback) {
        feedback += `\n\n${uploadFeedback}`
      }
    } else {
      feedback = `MCQ: ${mcqEarned.toFixed(2)}/${policy.mcq_total_points} · Upload: ${(uploadEarned ?? 0).toFixed(2)}/${policy.upload_total_points} pts.\n\n${uploadFeedback}`
    }
  } else {
    feedback = `MCQ: ${mcqEarned.toFixed(2)}/${policy.mcq_total_points} pts.`
  }

  const finalizedUploadPts = uploadEarned ?? 0
  const mcqFullyCorrect = breakdown.mcq_earned >= breakdown.mcq_max - 1e-6

  aiFeedback = {
    aiGraded: hasUpload && policy.upload_total_points > 0 && Boolean(aiResult?.aiGraded),
    multiPartMcqGraded: true,
    multiPartAiGraded: uploadEarned != null,
    uploadPending,
    uploadScorePercent:
      uploadEarned != null && policy.upload_total_points > 0
        ? parseFloat(((finalizedUploadPts / policy.upload_total_points) * 100).toFixed(2))
        : aiResult?.uploadScorePercent,
    uploadScorePercentPreview:
      uploadPending && aiResult ? aiResult.uploadScorePercent : undefined,
    uploadPointsEarned: finalizedUploadPts,
    uploadMaxPoints: policy.upload_total_points,
    mcqEarned: breakdown.mcq_earned,
    mcqMaxPoints: breakdown.mcq_max,
    pointsEarned: breakdown.total_earned,
    maxPoints: breakdown.total_max,
    score: overallPercent,
    feedback,
    solutionFeedback: hasUpload ? uploadFeedback || undefined : undefined,
    strengths: aiResult?.strengths,
    improvements: aiResult?.improvements,
    partNotes: aiResult?.partNotes,
    confidence: aiResult?.confidence,
    canAutoGrade: aiResult?.canAutoGrade,
    requiresManualReview: requiresReview,
    errorType: aiResult?.errorType,
    technicalError: aiResult?.technicalError,
    evaluatedAt: new Date().toISOString(),
    questionType: "multi_part",
  }

  const result: EvaluationResult = {
    isCorrect: mcqFullyCorrect && (!hasUpload || !uploadPending),
    points: overallPercent,
    feedback,
    requiresReview,
  }

  return {
    result,
    pointsEarned,
    requiresReview,
    breakdown,
    aiFeedback,
    answerDataExtras: multiPartGradingBreakdownToAnswerData(breakdown),
    maxPointsForQuestion,
  }
}

export { isMultiPartUploadPendingReview } from "@/lib/multi-part-pnd"
