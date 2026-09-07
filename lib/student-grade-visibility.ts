/** When students may see assessment scores in the gradebook (ECE2202 course eval feedback). */

export type StudentGradeReleaseInput = {
  completed_at?: string | Date | null
  results_finalized_at?: string | Date | null
  results_finalized?: boolean | null
  should_show_pnd?: boolean | null
}

/** Instructor has released this attempt's grade to the student gradebook. */
export function isStudentAssessmentGradeReleased(attempt: StudentGradeReleaseInput): boolean {
  if (attempt.should_show_pnd === true) return false
  if (attempt.results_finalized === true || attempt.results_finalized_at != null) return true
  return false
}

export function studentAssessmentGradeStatus(
  attempt: StudentGradeReleaseInput,
): "finalized" | "pending" {
  return isStudentAssessmentGradeReleased(attempt) ? "finalized" : "pending"
}

export function studentAssessmentGradeLabel(attempt: StudentGradeReleaseInput): string {
  if (!attempt.completed_at) return ""
  return isStudentAssessmentGradeReleased(attempt) ? "" : "Under review"
}
