/**
 * Student Ask Cora is only for constructed / written work.
 * Objective questions with a pre-programmed key must not expose Cora (students
 * could ask for the answer).
 */

const OBJECTIVE_QUESTION_TYPES = new Set([
  "mcq",
  "multiple_choice",
  "true_false",
  "truefalse",
  "tf",
  "select_all",
  "multi_select",
  "multiple_select",
  "multi_output",
  "fill_blank",
  "fill_in_blank",
  "numeric",
  "number",
  "matching",
  "ordering",
  "code_output",
  "trace_output",
  "fill_code",
  "trace_logic",
  "code_reorder",
  "scenario_match",
])

const WRITTEN_QUESTION_TYPES = new Set([
  "code_write",
  "code_write_plot",
  "circuit_submission",
  "circuit_multi_part",
  "code_problem",
  "debug_code",
  "code_debug",
  "code_explain",
  "file_upload",
  "solution_upload",
])

export function normalizeAskCoraQuestionType(questionType: string | null | undefined): string {
  return String(questionType || "")
    .toLowerCase()
    .trim()
    .replace(/-/g, "_")
}

export function canStudentAskCora(
  questionType: string | null | undefined,
  options?: { subquestionTypes?: Array<string | null | undefined> },
): boolean {
  const qt = normalizeAskCoraQuestionType(questionType)
  if (!qt) return false
  if (OBJECTIVE_QUESTION_TYPES.has(qt)) return false

  if (qt === "multi_part") {
    const subs = (options?.subquestionTypes ?? [])
      .map((type) => normalizeAskCoraQuestionType(type))
      .filter(Boolean)
    if (subs.length === 0) return false
    return subs.some((type) => canStudentAskCora(type))
  }

  return WRITTEN_QUESTION_TYPES.has(qt)
}
