/** Question types the server grades in POST /api/[assessmentType]/submit (not save-only). */
export const SERVER_GRADED_QUESTION_TYPES = new Set([
  "mcq",
  "multiple_choice",
  "true_false",
  "truefalse",
  "tf",
  "multi_select",
  "multiple_select",
  "select_all",
  "multi_output",
  "numeric",
  "number",
  "fill_blank",
  "fill_in_blank",
  "matching",
  "ordering",
  "code_output",
  "trace_output",
  "fill_code",
  "trace_logic",
])

export function isServerGradedQuestionType(questionType: string | null | undefined): boolean {
  const qt = String(questionType || "mcq")
    .toLowerCase()
    .trim()
    .replace(/-/g, "_")
    .replace(/\s+/g, "_")
  const aliases: Record<string, string> = {
    selectall: "select_all",
    select_all_that_apply: "select_all",
    sata: "select_all",
    checkbox: "select_all",
  }
  return SERVER_GRADED_QUESTION_TYPES.has(qt) || SERVER_GRADED_QUESTION_TYPES.has(aliases[qt] ?? "")
}
