import { FACULTY_DASHBOARD_BASE } from "@/lib/faculty-portal-nav-config"
import { getInstructorData } from "@/lib/auth"

/** Routes that work without an active course scope (create courses, profile, summer camp hub, etc.). */
export const FACULTY_UNSCOPED_ROUTE_PREFIXES = [
  `${FACULTY_DASHBOARD_BASE}/administration/my-courses`,
  `${FACULTY_DASHBOARD_BASE}/course/exchange`,
  `${FACULTY_DASHBOARD_BASE}/settings`,
  `${FACULTY_DASHBOARD_BASE}/membership`,
  `${FACULTY_DASHBOARD_BASE}/summer-camp`,
  `${FACULTY_DASHBOARD_BASE}/campers`,
] as const

export function normalizeFacultyDashboardPath(pathname: string | null | undefined): string {
  if (!pathname) return FACULTY_DASHBOARD_BASE
  return pathname.replace("/instructor/dashboard-v2", FACULTY_DASHBOARD_BASE)
}

export function facultyHasSelectedCourse(): boolean {
  const data = getInstructorData()
  const id = data?.selectedCourseId
  return id != null && String(id).trim() !== ""
}

export function isFacultyRouteRequiringCourseScope(pathname: string | null | undefined): boolean {
  const normalized = normalizeFacultyDashboardPath(pathname)
  if (!normalized.startsWith(FACULTY_DASHBOARD_BASE)) return false
  const relative = normalized.slice(FACULTY_DASHBOARD_BASE.length) || "/"
  if (relative === "/" || relative === "") return true
  for (const prefix of FACULTY_UNSCOPED_ROUTE_PREFIXES) {
    if (normalized === prefix || normalized.startsWith(prefix + "/")) return false
  }
  return true
}

/** Query keys that refer to entities in the previous course — drop on course switch. */
export const COURSE_SCOPED_SEARCH_PARAMS = new Set([
  "id",
  "new",
  "edit",
  "quizId",
  "lectureId",
  "studentId",
  "attemptId",
  "questionId",
  "deckId",
  "topicId",
  "projectId",
  "groupId",
  "sessionId",
  "announcementId",
  "requestId",
  "returnTo",
])

export function stripCourseScopedSearchParams(search: string): string {
  if (!search || search === "?") return ""
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search)
  let changed = false
  for (const key of COURSE_SCOPED_SEARCH_PARAMS) {
    if (params.has(key)) {
      params.delete(key)
      changed = true
    }
  }
  if (!changed) return search.startsWith("?") ? search : `?${search}`
  const next = params.toString()
  return next ? `?${next}` : ""
}
