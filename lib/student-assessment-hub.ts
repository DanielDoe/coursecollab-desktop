/** Shared helpers — student assignment hub (deadlines, pending banner, deep links). */

export type StudentAssessmentHubType =
  | "quiz"
  | "homework"
  | "midterm"
  | "final"
  | "code_submission"

export type StudentAssessmentHubItem = {
  id: string
  assessmentId: number
  title: string
  type: StudentAssessmentHubType
  href: string
  moduleHref: string
  dueDate?: string
  opensAt?: string
  instructions?: string
  status: "open" | "coming_soon" | "pending"
}

export function stripAssessmentInstructions(raw: unknown, maxLen = 160): string | undefined {
  if (typeof raw !== "string") return undefined
  const text = raw
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  if (!text) return undefined
  if (text.length <= maxLen) return text
  return `${text.slice(0, maxLen - 1).trim()}…`
}

export function assessmentTakeHref(type: StudentAssessmentHubType, id: number): string {
  switch (type) {
    case "homework":
      return `/student/homework/${id}`
    case "quiz":
      return `/student/quiz/${id}`
    case "midterm":
      return `/student/mid-semester-exams/take/${id}`
    case "final":
      return `/student/final-exams/take/${id}`
    case "code_submission":
      return `/student/dashboard-v2/classroom-points`
  }
}

export function assessmentModuleHref(type: StudentAssessmentHubType): string {
  switch (type) {
    case "homework":
      return "/student/dashboard-v2/homework"
    case "quiz":
      return "/student/dashboard-v2/quizzes"
    case "midterm":
      return "/student/dashboard-v2/mid-semester-exams"
    case "final":
      return "/student/dashboard-v2/final-exams"
    case "code_submission":
      return "/student/dashboard-v2/classroom-points"
  }
}

/** Canonical results URL — `/student/results/{attemptId}?type=…` */
export function studentAssessmentResultsHref(
  attemptId: number,
  assessmentType: string,
): string {
  const t = String(assessmentType ?? "quiz")
    .toLowerCase()
    .trim()
    .replace(/-/g, "_")

  if (t === "homework") return `/student/results/${attemptId}?type=homework`
  if (t === "mid_semester" || t === "midsem") return `/student/results/${attemptId}?type=mid_semester`
  if (t === "final" || t === "finals" || t === "final_exam") {
    return `/student/results/${attemptId}?type=final`
  }
  return `/student/results/${attemptId}?type=quiz`
}

/** Quiz/homework id shortcut — resolves latest attempt client-side on dedicated results pages. */
export function studentAssessmentResultsByQuizHref(
  quizId: number,
  assessmentType: string,
): string {
  const t = String(assessmentType ?? "quiz")
    .toLowerCase()
    .trim()
    .replace(/-/g, "_")
  if (t === "homework") return `/student/homework/${quizId}/results`
  return `/student/quiz/${quizId}/results`
}

export function buildAssessmentHubItem(input: {
  type: StudentAssessmentHubType
  id: number
  title?: string
  description?: unknown
  available_from?: string | null
  available_until?: string | null
  status: "open" | "coming_soon" | "pending"
  idPrefix: string
}): StudentAssessmentHubItem {
  const label =
    input.type === "quiz"
      ? "Quiz"
      : input.type === "homework"
        ? "Homework"
        : input.type === "midterm"
          ? "Midterm"
          : input.type === "final"
            ? "Final"
            : "Classroom assignment"

  return {
    id: `${input.idPrefix}-${input.id}`,
    assessmentId: input.id,
    title: input.title?.trim() || label,
    type: input.type,
    href: assessmentTakeHref(input.type, input.id),
    moduleHref: assessmentModuleHref(input.type),
    dueDate: input.available_until ?? undefined,
    opensAt: input.available_from ?? undefined,
    instructions: stripAssessmentInstructions(input.description),
    status: input.status,
  }
}
