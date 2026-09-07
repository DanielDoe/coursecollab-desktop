/**
 * Teaching Assistant permission model — course-scoped assistance without policy ownership.
 * Single TA role; instructors grant/revoke capabilities per course via course_staff_permissions.
 */

export type TaPermissionKey =
  | "canPublishAnnouncements"
  | "canEditQuizzes"
  | "canEditHomework"
  | "canPublishQuizzes"
  | "canPublishHomework"
  | "canPublishClassroomPoints"
  | "canGradeAssignments"
  | "canGradeExams"
  | "canManageGroups"
  | "canManageAttendance"
  | "canHoldOfficeHours"
  | "canViewAnalytics"
  | "canManagePracticeContent"
  | "canDraftAnnouncements"
  | "canTakeAttendance"
  | "canModerateDiscussions"
  | "canViewAssessments"
  | "canManageLectures"
  | "canManagePlayground"
  | "canManageProjects"
  | "canManageClassroomPoints"
  | "canManageSyllabus"

export type TaPermissionSet = Record<TaPermissionKey, boolean>

export const TA_PERMISSION_KEYS: TaPermissionKey[] = [
  "canPublishAnnouncements",
  "canEditQuizzes",
  "canEditHomework",
  "canPublishQuizzes",
  "canPublishHomework",
  "canPublishClassroomPoints",
  "canGradeAssignments",
  "canGradeExams",
  "canManageGroups",
  "canManageAttendance",
  "canHoldOfficeHours",
  "canViewAnalytics",
  "canManagePracticeContent",
  "canDraftAnnouncements",
  "canTakeAttendance",
  "canModerateDiscussions",
  "canViewAssessments",
  "canManageLectures",
  "canManagePlayground",
  "canManageProjects",
  "canManageClassroomPoints",
  "canManageSyllabus",
]

/** Default TA — matches role_permissions for course_staff.role = TA */
export const DEFAULT_TA_PERMISSIONS: TaPermissionSet = {
  canPublishAnnouncements: false,
  canEditQuizzes: false,
  canEditHomework: false,
  canPublishQuizzes: false,
  canPublishHomework: false,
  canPublishClassroomPoints: false,
  canGradeAssignments: true,
  canGradeExams: false,
  canManageGroups: true,
  canManageAttendance: true,
  canHoldOfficeHours: true,
  canViewAnalytics: true,
  canManagePracticeContent: true,
  canDraftAnnouncements: true,
  canTakeAttendance: true,
  canModerateDiscussions: true,
  canViewAssessments: false,
  canManageLectures: true,
  canManagePlayground: true,
  canManageProjects: true,
  canManageClassroomPoints: false,
  canManageSyllabus: false,
}

export type TaPermissionsStore = {
  /** Per-course overrides: { "12": { canPublishQuizzes: true } } */
  byCourse?: Record<string, Partial<TaPermissionSet>>
}

export function mergeTaPermissions(
  stored?: TaPermissionsStore | null,
  courseId?: number | null,
): TaPermissionSet {
  const base = { ...DEFAULT_TA_PERMISSIONS }
  if (!stored?.byCourse || courseId == null) return base
  const overrides = stored.byCourse[String(courseId)]
  if (!overrides) return base
  for (const key of TA_PERMISSION_KEYS) {
    if (typeof overrides[key] === "boolean") {
      base[key] = overrides[key]!
    }
  }
  return base
}

export function canTa(permissions: TaPermissionSet, key: TaPermissionKey): boolean {
  return Boolean(permissions[key])
}

const TA_POLICY_FORBIDDEN_PREFIXES = [
  "/faculty/dashboard/administration",
  "/faculty/dashboard/recommendations",
  "/faculty/dashboard/students/trade-center",
  "/faculty/dashboard/content/ai-tutor",
  "/instructor/dashboard-v2/administration",
  "/instructor/dashboard-v2/recommendations",
  "/instructor/dashboard-v2/students/trade-center",
  "/instructor/dashboard-v2/content/ai-tutor",
  "/instructor/dashboard-v2/management/instructors",
] as const

/** Policy / platform pages TAs must never open (assessment access is permission-driven). */
export function isTaPolicyForbiddenPath(pathname: string): boolean {
  const normalized = pathname.replace("/instructor/dashboard-v2", "/faculty/dashboard")
  return TA_POLICY_FORBIDDEN_PREFIXES.some(
    (p) => normalized === p || normalized.startsWith(p + "/"),
  )
}

/** @deprecated Assessment routes use FacultyPermissionRouteGuard + RBAC overrides. */
export function isTaForbiddenPath(pathname: string): boolean {
  return isTaPolicyForbiddenPath(pathname)
}

export function isTaRole(role: string | undefined | null): boolean {
  return role === "ta"
}

export const TA_REQUIRES_INSTRUCTOR_APPROVAL: Partial<Record<TaPermissionKey, string>> = {
  canPublishQuizzes: "Publishing quizzes to students requires instructor approval.",
  canPublishHomework: "Publishing homework to students requires instructor approval.",
  canPublishAnnouncements: "Publishing announcements requires instructor approval.",
  canPublishClassroomPoints: "Releasing classroom points to students requires instructor approval.",
  canGradeExams: "Grading exams may require instructor approval.",
  canManageClassroomPoints: "Classroom points access requires instructor approval.",
}
