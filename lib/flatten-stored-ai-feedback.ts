/**
 * Normalize ai_feedback persisted from evaluate → submit.
 * formatEvaluateApiResponse wraps the real payload in a nested `aiFeedback` field;
 * readers must merge that inner object so rubric / scoreBreakdown are available.
 */
const NESTED_DETAIL_KEYS = [
  "rubricScores",
  "rubricScoresPreview",
  "rubric_scores",
  "totalScore",
  "totalScorePreview",
  "strengths",
  "improvements",
  "confidence",
  "canAutoGrade",
  "circuitSubmissionAiGraded",
  "provisionalScore",
  "requiresInstructorApproval",
  "gradingOutcome",
  "expectedAnswerUsed",
  "evaluatedAt",
  "questionType",
  "scoreBreakdown",
  "criteria",
  "itemizedIssues",
  "gradeBreakdown",
  "suggestions",
  "detailedExplanation",
  "sampleAnswers",
  "evaluationDiagnostics",
  "status",
  "statusMessage",
  "errorType",
  "technicalError",
  "feedback",
  "solutionFeedback",
  "partNotes",
  "uploadPending",
  "mcqEarned",
  "mcqMaxPoints",
  "uploadPointsEarned",
  "uploadMaxPoints",
  "multiPartMcqGraded",
  "multiPartAiGraded",
] as const

export function flattenStoredAiFeedback(raw: unknown): Record<string, unknown> | null {
  if (raw == null || raw === "") return null

  let o: Record<string, unknown>
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as unknown
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null
      o = parsed as Record<string, unknown>
    } catch {
      return { feedback: raw }
    }
  } else if (typeof raw === "object" && !Array.isArray(raw)) {
    o = raw as Record<string, unknown>
  } else {
    return null
  }

  const nested = o.aiFeedback
  if (!nested || typeof nested !== "object" || Array.isArray(nested)) {
    return o
  }

  const inner = nested as Record<string, unknown>
  const merged: Record<string, unknown> = { ...o }

  for (const key of NESTED_DETAIL_KEYS) {
    if (merged[key] == null && inner[key] != null) {
      merged[key] = inner[key]
    }
  }

  if (merged.rubricScores == null && inner.rubric_scores != null) {
    merged.rubricScores = inner.rubric_scores
  }

  delete merged.aiFeedback
  return merged
}
