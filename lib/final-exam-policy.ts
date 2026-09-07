/** DB `quizzes.assessment_type` values we treat as final exams (single-sitting, no rollover/retake perks). */
export function isFinalAssessmentDbType(value: string | null | undefined): boolean {
  const t = (value || "").toLowerCase().trim()
  return t === "final" || t === "finals" || t === "final_exam"
}

export function isMidSemesterAssessmentDbType(value: string | null | undefined): boolean {
  const t = (value || "").toLowerCase().trim()
  return t === "mid_semester" || t === "mid-semester" || t === "midsem"
}

/** Mid-semester and finals: one sitting — no membership retakes or rollovers. */
export function isSingleSittingExamAssessmentDbType(value: string | null | undefined): boolean {
  return isFinalAssessmentDbType(value) || isMidSemesterAssessmentDbType(value)
}

/** SQL `NOT IN (...)` fragment for excluding single-sitting exam types from rollover queries. */
export const SINGLE_SITTING_EXAM_ASSESSMENT_TYPES_SQL = [
  "final",
  "finals",
  "final_exam",
  "mid_semester",
  "mid-semester",
  "midsem",
] as const
