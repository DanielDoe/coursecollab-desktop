import { FACULTY_DASHBOARD_BASE } from "@/lib/faculty-portal-nav-config"

/** Map browser pathname to canonical dashboard-v2 internal path for route guards. */
export function facultyDashboardCanonicalPath(pathname: string | null | undefined): string {
  if (!pathname) return ""
  if (pathname.startsWith(FACULTY_DASHBOARD_BASE)) {
    return `/instructor/dashboard-v2${pathname.slice(FACULTY_DASHBOARD_BASE.length)}`
  }
  return pathname
}

/** True when the browser pathname is the v2 dashboard shell (faculty URL or legacy instructor URL). */
export function isFacultyDashboardV2Path(pathname: string | null | undefined): boolean {
  if (!pathname) return false
  return (
    pathname.startsWith(FACULTY_DASHBOARD_BASE) ||
    pathname.startsWith("/instructor/dashboard-v2")
  )
}

export function isFacultyPortalAuthFreePath(pathname: string | null | undefined): boolean {
  if (!pathname) return false
  return (
    pathname === "/instructor/login" ||
    pathname === "/instructor/select-course" ||
    pathname === "/instructor/change-password" ||
    pathname === "/faculty/login" ||
    pathname === "/faculty/select-course" ||
    pathname === "/faculty/change-password" ||
    pathname === "/auth/theme"
  )
}

export function isFacultyPortalAppPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false
  return pathname.startsWith("/instructor") || pathname.startsWith("/faculty")
}

/** Instructor APIs + auth apply on both legacy /instructor and /faculty dashboard URLs. */
export function isFacultyInstructorPortalPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false
  return pathname.startsWith("/instructor") || pathname.startsWith("/faculty")
}

export function facultyAssessmentsListPath(
  pathname: string | null | undefined,
  assessmentType: string,
): string {
  const segment =
    assessmentType === "homework"
      ? "homework"
      : assessmentType === "quiz"
        ? "quizzes"
        : assessmentType === "mid_semester"
          ? "mid-semester"
          : assessmentType === "final"
            ? "finals"
            : "quizzes"
  if (pathname?.startsWith(FACULTY_DASHBOARD_BASE)) {
    return `${FACULTY_DASHBOARD_BASE}/assessments/${segment}`
  }
  if (pathname?.includes("/instructor/dashboard-v2")) {
    return `/instructor/dashboard-v2/assessments/${segment}`
  }
  return `/instructor/${assessmentType}`
}
