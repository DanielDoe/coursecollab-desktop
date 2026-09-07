/**
 * Portal permission model — instructor (course-scoped) vs admin (institution-scoped).
 */

export const INSTRUCTOR_ALLOWED_SCOPES = [
  "own_courses",
  "own_assessments",
  "own_grading_policies",
  "own_attendance_policies",
  "own_classroom_points",
  "own_ai_assistant_settings",
  "own_projects_groups",
  "own_submission_issues",
] as const

export const ADMIN_ALLOWED_SCOPES = [
  "users",
  "courses",
  "enrollments",
  "finances",
  "security",
  "infrastructure",
  "platform_config",
  "institution_analytics",
  "global_communication",
] as const

export const INSTRUCTOR_FORBIDDEN_SCOPES = [
  "platform_settings",
  "user_accounts_global",
  "financial_records",
  "security_settings",
  "infrastructure",
  "institution_policies",
] as const

/** Admin paths that are instructional — redirect to dashboard (view/audit only via Academic Affairs). */
export const ADMIN_RESTRICTED_PATH_PREFIXES = [
  "/admin/dashboard-v2/content/lectures",
  "/admin/dashboard-v2/content/practice",
  "/admin/dashboard-v2/content/ai-tutor",
  "/admin/dashboard-v2/course/playground",
  "/admin/dashboard-v2/assessments/quizzes",
  "/admin/dashboard-v2/assessments/homework",
  "/admin/dashboard-v2/assessments/mid-semester",
  "/admin/dashboard-v2/assessments/finals",
  "/admin/dashboard-v2/assessments/grades",
  "/admin/dashboard-v2/assessments/classroom-points",
  "/admin/dashboard-v2/assessments/attendance",
  "/admin/dashboard-v2/learning-center/office-hours",
  "/admin/dashboard-v2/recommendations",
  "/admin/dashboard-v2/students/trade-center",
  "/admin/dashboard-v2/management/groups",
  "/admin/dashboard-v2/management/projects",
] as const

export function isAdminTeachingRoute(pathname: string): boolean {
  return ADMIN_RESTRICTED_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + "/"),
  )
}

/** Legacy instructor platform-admin URLs → course administration equivalents. */
export const INSTRUCTOR_LEGACY_ADMIN_REDIRECTS: Record<string, string> = {
  "/instructor/dashboard-v2/administration/financials": "/instructor/dashboard-v2",
  "/instructor/dashboard-v2/administration/system-monitor": "/instructor/dashboard-v2",
  "/instructor/dashboard-v2/administration/logs": "/instructor/dashboard-v2",
  "/instructor/dashboard-v2/administration/submission-diagnostics":
    "/instructor/dashboard-v2/administration/submission-issues",
}

export function instructorLegacyAdminRedirect(pathname: string): string | null {
  const exact = INSTRUCTOR_LEGACY_ADMIN_REDIRECTS[pathname]
  if (exact) return exact
  if (pathname.startsWith("/instructor/dashboard-v2/administration/submission-diagnostics/")) {
    return "/instructor/dashboard-v2/administration/submission-issues"
  }
  return null
}
