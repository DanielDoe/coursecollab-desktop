/**
 * CourseCollab canonical role model — six core roles only.
 * TA flexibility uses per-course permission overrides, not extra role codes.
 */

/** Platform / institution roles (admin_users.role) */
export const PLATFORM_ROLES = ["PLATFORM_ADMIN", "DEPARTMENT_ADMIN"] as const
export type PlatformRole = (typeof PLATFORM_ROLES)[number]

/** Faculty account roles on `instructors` table (lowercase for legacy column) */
export const FACULTY_ACCOUNT_ROLES = ["instructor", "ta", "department_admin"] as const
export type FacultyAccountRole = (typeof FACULTY_ACCOUNT_ROLES)[number]

/** Course-scoped staff roles (`course_staff.role`) */
export const COURSE_STAFF_ROLES = ["INSTRUCTOR", "TA", "COURSE_OBSERVER"] as const
export type CourseStaffRole = (typeof COURSE_STAFF_ROLES)[number]

export const STUDENT_ROLE = "STUDENT" as const

/** Display order (highest privilege first) */
export const ROLE_HIERARCHY: readonly string[] = [
  "PLATFORM_ADMIN",
  "DEPARTMENT_ADMIN",
  "INSTRUCTOR",
  "TA",
  "COURSE_OBSERVER",
  "STUDENT",
]

const LEGACY_COURSE_STAFF_ROLE_MAP: Record<string, CourseStaffRole> = {
  LEAD_TA: "TA",
  GRADER: "TA",
  OBSERVER: "COURSE_OBSERVER",
}

export function normalizeCourseStaffRole(
  role: string | null | undefined,
): CourseStaffRole | null {
  if (!role) return null
  const upper = role.trim().toUpperCase()
  if ((COURSE_STAFF_ROLES as readonly string[]).includes(upper)) {
    return upper as CourseStaffRole
  }
  const mapped = LEGACY_COURSE_STAFF_ROLE_MAP[upper]
  return mapped ?? null
}

export function isCourseStaffRole(role: string | null | undefined): role is CourseStaffRole {
  return normalizeCourseStaffRole(role) != null
}

export function courseStaffRoleLabel(role: string | null | undefined): string {
  const normalized = normalizeCourseStaffRole(role) ?? role?.toUpperCase()
  switch (normalized) {
    case "INSTRUCTOR":
      return "Instructor"
    case "TA":
      return "Teaching Assistant"
    case "COURSE_OBSERVER":
      return "Observer"
    default:
      return "Faculty"
  }
}

export function platformRoleLabel(role: string | null | undefined): string {
  switch (role?.toUpperCase()) {
    case "PLATFORM_ADMIN":
      return "Platform Administrator"
    case "DEPARTMENT_ADMIN":
      return "Department Administrator"
    default:
      return "Administrator"
  }
}

export function normalizePlatformRole(role: string | null | undefined): PlatformRole {
  const upper = (role ?? "PLATFORM_ADMIN").trim().toUpperCase()
  return upper === "DEPARTMENT_ADMIN" ? "DEPARTMENT_ADMIN" : "PLATFORM_ADMIN"
}

export function normalizeFacultyAccountRole(role: string | null | undefined): FacultyAccountRole {
  const r = String(role ?? "instructor").trim().toLowerCase()
  if (r === "ta") return "ta"
  if (r === "department_admin") return "department_admin"
  return "instructor"
}

export function isFacultyAccountRole(role: string | null | undefined): boolean {
  return FACULTY_ACCOUNT_ROLES.includes(normalizeFacultyAccountRole(role))
}

export function isTaFacultyAccount(role: string | null | undefined): boolean {
  return normalizeFacultyAccountRole(role) === "ta"
}

/** Deprecated course_staff / ta_level values — never assign new rows with these */
export const DEPRECATED_COURSE_STAFF_ROLES = ["LEAD_TA", "GRADER", "OBSERVER"] as const
