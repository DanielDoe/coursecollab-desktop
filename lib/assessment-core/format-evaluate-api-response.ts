import { canVerifyLocally } from "@/lib/local-answer-verification"

/**
 * Shared JSON shape for /api/{assessmentType}/evaluate and legacy /api/quiz/evaluate.
 */
export function formatEvaluateApiResponse(args: {
  result: {
    isCorrect?: boolean
    points?: number
    pointsEarned?: number
    feedback?: string
    requiresReview?: boolean
  }
  aiFeedback?: Record<string, unknown> | null
  questionType: string
  maxPoints: number
}) {
  const { result, aiFeedback, questionType, maxPoints } = args
  const qtLower = (questionType || "").toLowerCase()
  const isCodeAi = ["code_write", "code_debug", "code_problem", "code_write_plot", "code_explain"].includes(
    qtLower,
  )
  const isMultiPartGraded =
    qtLower === "multi_part" && Boolean(aiFeedback?.multiPartMcqGraded || aiFeedback?.multiPartAiGraded)
  const isMultiPartAi = qtLower === "multi_part" && Boolean(aiFeedback?.aiGraded)
  const isMultiPartWithAi = qtLower === "multi_part" && Boolean(aiFeedback)
  const isCircuitAi =
    qtLower === "circuit_submission" &&
    Boolean(aiFeedback?.aiGraded || aiFeedback?.circuitSubmissionAiGraded)

  const circuitSpread =
    isCircuitAi && aiFeedback
      ? {
          provisionalScore: aiFeedback.provisionalScore,
          requiresInstructorApproval: aiFeedback.requiresInstructorApproval,
          totalScorePreview: aiFeedback.totalScorePreview,
          rubricScoresPreview: aiFeedback.rubricScoresPreview,
          circuitSubmissionAiGraded: aiFeedback.circuitSubmissionAiGraded,
          gradingOutcome: aiFeedback.gradingOutcome,
          strengths: aiFeedback.strengths,
          improvements: aiFeedback.improvements,
        }
      : {}

  const isAutoKeyGraded = canVerifyLocally(qtLower)

  return {
    isCorrect: result.isCorrect,
    score: qtLower === "multi_part" ? (aiFeedback?.score ?? result.points) : result.points,
    pointsEarned: result.pointsEarned,
    maxPoints,
    feedback: result.feedback,
    aiGraded: (isCodeAi || isMultiPartAi || isCircuitAi) && !isAutoKeyGraded,
    locallyVerified:
      isAutoKeyGraded || (!result.requiresReview && !isMultiPartAi && !isCodeAi && !isCircuitAi),
    requiresManualReview: result.requiresReview,
    questionType: qtLower === "multi_part" ? "multi_part" : undefined,
    ...(isMultiPartGraded && aiFeedback
      ? {
          multiPartMcqGraded: aiFeedback.multiPartMcqGraded,
          multiPartAiGraded: aiFeedback.multiPartAiGraded,
          uploadPending: aiFeedback.uploadPending,
          mcqEarned: aiFeedback.mcqEarned,
          mcqMaxPoints: aiFeedback.mcqMaxPoints,
          uploadPointsEarned: aiFeedback.uploadPointsEarned,
          uploadMaxPoints: aiFeedback.uploadMaxPoints,
          uploadScorePercentPreview: aiFeedback.uploadScorePercentPreview,
          solutionFeedback: aiFeedback.solutionFeedback,
          strengths: aiFeedback.strengths,
          improvements: aiFeedback.improvements,
          partNotes: aiFeedback.partNotes,
        }
      : {}),
    itemizedIssues: aiFeedback?.itemizedIssues,
    gradeBreakdown: aiFeedback?.gradeBreakdown,
    criteria: aiFeedback?.criteria,
    suggestions: aiFeedback?.suggestions,
    detailedExplanation: aiFeedback?.detailedExplanation,
    sampleAnswers: aiFeedback?.sampleAnswers,
    status: aiFeedback?.status,
    statusMessage: aiFeedback?.statusMessage,
    ...circuitSpread,
    ...(isMultiPartWithAi
      ? {
          questionType: "multi_part",
          uploadPending: aiFeedback?.uploadPending,
          solutionFeedback: aiFeedback?.solutionFeedback ?? aiFeedback?.feedback,
          strengths: aiFeedback?.strengths,
          improvements: aiFeedback?.improvements,
          partNotes: aiFeedback?.partNotes,
        }
      : {}),
    aiFeedback,
  }
}
