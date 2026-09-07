import { sql } from "@/lib/db"
import { ensurePortalRbacSchema } from "@/lib/ensure-portal-rbac-schema"
import type { RbacPermissionCode } from "@/lib/rbac-permission-codes"
import { normalizeCourseStaffRole, type CourseStaffRole } from "@/lib/roles"
import { INSTRUCTOR_ROLE_PERMISSION_CODES } from "@/lib/rbac-role-permission-catalog"

export type UserCoursePermissionsResult = {
  permissions: string[]
  staffRole: CourseStaffRole | null
  courseStaffId: number | null
}

/** Full teaching authority for course owners and INSTRUCTOR staff. */
export const FULL_INSTRUCTOR_COURSE_PERMISSIONS: RbacPermissionCode[] = [
  ...INSTRUCTOR_ROLE_PERMISSION_CODES,
]

/** @deprecated Use FULL_INSTRUCTOR_COURSE_PERMISSIONS */
const INSTRUCTOR_SCOPE_CODES = FULL_INSTRUCTOR_COURSE_PERMISSIONS

/**
 * Resolve effective permissions for an academic staff member in a course.
 * Combines course_staff.role → role_permissions with course_staff_permissions overrides.
 */
export async function getUserCoursePermissions(
  userId: number,
  courseId: number,
): Promise<UserCoursePermissionsResult> {
  await ensurePortalRbacSchema()

  const staffRows = await sql`
    SELECT id, role
    FROM course_staff
    WHERE course_id = ${courseId}
      AND instructor_id = ${userId}
      AND is_active = true
    LIMIT 1
  `

  if (staffRows.length === 0) {
    const ownerRows = await sql`
      SELECT id FROM courses
      WHERE id = ${courseId} AND instructor_id = ${userId} AND is_active = true
      LIMIT 1
    `
    if (ownerRows.length > 0) {
      return {
        permissions: [...FULL_INSTRUCTOR_COURSE_PERMISSIONS],
        staffRole: "INSTRUCTOR",
        courseStaffId: null,
      }
    }
    return { permissions: [], staffRole: null, courseStaffId: null }
  }

  const staff = staffRows[0] as { id: number; role: string }
  const staffRole = normalizeCourseStaffRole(staff.role)
  const courseStaffId = staff.id

  if (!staffRole) {
    return { permissions: [], staffRole: null, courseStaffId }
  }

  if (staffRole === "INSTRUCTOR") {
    return {
      permissions: [...FULL_INSTRUCTOR_COURSE_PERMISSIONS],
      staffRole,
      courseStaffId,
    }
  }

  const rolePermRows = await sql`
    SELECT permission_code FROM role_permissions WHERE role = ${staffRole}
  `
  const effective = new Set<string>(
    (rolePermRows as { permission_code: string }[]).map((r) => r.permission_code),
  )

  const overrideRows = await sql`
    SELECT permission_code, enabled
    FROM course_staff_permissions
    WHERE course_staff_id = ${courseStaffId}
  `
  for (const row of overrideRows as { permission_code: string; enabled: boolean }[]) {
    if (row.enabled) effective.add(row.permission_code)
    else effective.delete(row.permission_code)
  }

  return {
    permissions: Array.from(effective),
    staffRole,
    courseStaffId,
  }
}

export { hasPermission, hasAnyPermission } from "@/lib/permission-utils"
