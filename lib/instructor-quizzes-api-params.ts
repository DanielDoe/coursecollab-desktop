/** Query param accepted by GET `/api/instructor/quizzes` (`assessmentType` / `assessment_type`). */
export function instructorQuizzesAssessmentTypeParam(
  at: "quiz" | "homework" | "mid_semester" | "final" | string,
): string {
  switch (at) {
    case "mid_semester":
      return "midsem"
    case "final":
      return "finals"
    default:
      return at
  }
}
