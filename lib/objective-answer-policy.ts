/**
 * Section I types students may revise until the assessment is submitted (exam mode).
 * Graded from the answer key only — never AI.
 */
export const EDITABLE_OBJECTIVE_QUESTION_TYPES = new Set([
  "mcq",
  "multiple_choice",
  "true_false",
  "select_all",
  "multi_output",
])

export function isEditableObjectiveQuestionType(questionType: string | null | undefined): boolean {
  return EDITABLE_OBJECTIVE_QUESTION_TYPES.has(String(questionType || "").toLowerCase().trim())
}

/** Homework keeps instant per-question feedback, so its objective answers stay locked once submitted. */
export function objectiveAnswersEditableForAssessment(assessmentType: string | null | undefined): boolean {
  const t = String(assessmentType ?? "").trim().toLowerCase()
  return t !== "homework" && t !== "homeworks"
}

/** Exam mode: objective answers are revisable and correctness stays hidden until submit. */
export function isRevisableObjectiveQuestion(
  questionType: string | null | undefined,
  assessmentType: string | null | undefined,
): boolean {
  return isEditableObjectiveQuestionType(questionType) && objectiveAnswersEditableForAssessment(assessmentType)
}
