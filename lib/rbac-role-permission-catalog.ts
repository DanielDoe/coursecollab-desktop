import type { RbacPermissionCode } from "@/lib/rbac-permission-codes"
import { RBAC_PERMISSION_CODES } from "@/lib/rbac-permission-codes"
import { TA_KEY_TO_PERMISSION_CODE } from "@/lib/rbac-permission-codes"
import { DEFAULT_TA_PERMISSIONS, TA_PERMISSION_KEYS } from "@/lib/ta-permissions"

/** Platform-only — never granted to course INSTRUCTOR staff by default. */
export const PLATFORM_SCOPED_PERMISSION_CODES = [
  "view_institutional_analytics",
  "manage_financials",
  "manage_platform",
  "manage_users",
  "manage_feature_flags",
  "manage_integrations",
  "manage_subscriptions",
  "view_audit_logs",
] as const satisfies readonly RbacPermissionCode[]

const platformSet = new Set<string>(PLATFORM_SCOPED_PERMISSION_CODES)

/** All course-scoped teaching permissions (matches migration portal-rbac/01 INSTRUCTOR grant). */
export const INSTRUCTOR_ROLE_PERMISSION_CODES: RbacPermissionCode[] = RBAC_PERMISSION_CODES.filter(
  (code) => !platformSet.has(code),
)

export const DEPARTMENT_ADMIN_ROLE_PERMISSION_CODES = [
  "manage_courses",
  "manage_sections",
  "assign_course_staff",
  "manage_enrollments",
  "manage_tas",
  "manage_students",
  "view_institutional_analytics",
  "view_analytics",
  "view_assessments",
  "view_grades_readonly",
] as const satisfies readonly RbacPermissionCode[]

export const COURSE_OBSERVER_ROLE_PERMISSION_CODES = [
  "view_analytics",
  "view_course_content",
  "view_assessments",
  "view_grades_readonly",
] as const satisfies readonly RbacPermissionCode[]

function taDefaultPermissionCodes(): RbacPermissionCode[] {
  const codes = new Set<RbacPermissionCode>()
  for (const key of TA_PERMISSION_KEYS) {
    if (!DEFAULT_TA_PERMISSIONS[key]) continue
    const code = TA_KEY_TO_PERMISSION_CODE[key]
    if (code) codes.add(code)
  }
  return Array.from(codes)
}

export const TA_ROLE_PERMISSION_CODES: RbacPermissionCode[] = taDefaultPermissionCodes()

export const PLATFORM_ADMIN_ROLE_PERMISSION_CODES: RbacPermissionCode[] = [...RBAC_PERMISSION_CODES]

/** Expected row counts — used to detect incomplete seeds and repair. */
export const EXPECTED_ROLE_PERMISSION_COUNTS: Record<string, number> = {
  INSTRUCTOR: INSTRUCTOR_ROLE_PERMISSION_CODES.length,
  TA: TA_ROLE_PERMISSION_CODES.length,
  COURSE_OBSERVER: COURSE_OBSERVER_ROLE_PERMISSION_CODES.length,
  DEPARTMENT_ADMIN: DEPARTMENT_ADMIN_ROLE_PERMISSION_CODES.length,
  PLATFORM_ADMIN: PLATFORM_ADMIN_ROLE_PERMISSION_CODES.length,
}

export const ROLE_PERMISSION_CATALOG: Record<string, readonly RbacPermissionCode[]> = {
  INSTRUCTOR: INSTRUCTOR_ROLE_PERMISSION_CODES,
  TA: TA_ROLE_PERMISSION_CODES,
  COURSE_OBSERVER: COURSE_OBSERVER_ROLE_PERMISSION_CODES,
  DEPARTMENT_ADMIN: DEPARTMENT_ADMIN_ROLE_PERMISSION_CODES,
  PLATFORM_ADMIN: PLATFORM_ADMIN_ROLE_PERMISSION_CODES,
}
