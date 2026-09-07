/** Sidebar landing paths — keep drawer expanded on core module list pages. */

export const STUDENT_MODULE_EXPANDED_SIDEBAR_PATHS = [
  "/student/dashboard-v2/homework",
  "/student/dashboard-v2/quizzes",
  "/student/dashboard-v2/classroom-points",
  "/student/dashboard-v2/grades",
  "/student/dashboard-v2/practice",
  "/student/dashboard-v2/flashcards",
  "/student/dashboard-v2/notes",
]

export function isStudentModuleQuickNavPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false
  const normalized = pathname.replace(/\/$/, "")
  if (STUDENT_MODULE_EXPANDED_SIDEBAR_PATHS.some((p) => normalized === p || normalized.startsWith(`${p}/`))) {
    return true
  }
  return (
    normalized.startsWith("/student/dashboard-v2/practice/") ||
    normalized.startsWith("/student/quiz/") ||
    normalized.startsWith("/student/homework/") ||
    normalized.startsWith("/student/mid-semester-exams/take/") ||
    /^\/student\/(homework|quiz|midsem|final|mid_semester|finals)\//.test(normalized)
  )
}

export function shouldShowStudentModuleQuickNav(pathname: string | null | undefined): boolean {
  if (!pathname) return false
  const normalized = pathname.replace(/\/$/, "")
  if (normalized.includes("/codebench") && !normalized.includes("/codebench/more")) return false
  if (/\/lectures\/\d+$/.test(normalized)) return false
  return isStudentModuleQuickNavPath(normalized)
}
