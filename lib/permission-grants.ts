import { sql } from "@/lib/db"
import { ensurePortalRbacSchema } from "@/lib/ensure-portal-rbac-schema"
import { getUserCoursePermissions } from "@/lib/course-permissions"
import { INSTRUCTOR_ROLE_PERMISSION_CODES } from "@/lib/rbac-role-permission-catalog"
import { getPlatformPermissions } from "@/lib/platform-permissions"
import { ensureCourseStaffRow } from "@/lib/course-staff-sync"
import type { UserKind } from "@/lib/user-directory"

export type PermissionCatalogEntry = {
  code: string
  description: string | null
}

export type UserPermissionGrantState = {
  inherited: string[]
  additional: string[]
  effective: string[]
  courseStaffId: number | null
}

export async function listAllPermissions(): Promise<PermissionCatalogEntry[]> {
  await ensurePortalRbacSchema()
  const rows = await sql`
    SELECT code, description FROM permissions ORDER BY code ASC
  `
  return (rows as { code: string; description: string | null }[]).map((r) => ({
    code: r.code,
    description: r.description,
  }))
}

async function roleDefaultPermissions(role: string): Promise<Set<string>> {
  if (role === "INSTRUCTOR") {
    return new Set(INSTRUCTOR_ROLE_PERMISSION_CODES)
  }
  const rows = await sql`
    SELECT permission_code FROM role_permissions WHERE role = ${role}
  `
  return new Set((rows as { permission_code: string }[]).map((r) => r.permission_code))
}

export async function getPlatformUserPermissionState(
  adminUserId: number,
  platformRole: string,
): Promise<UserPermissionGrantState> {
  await ensurePortalRbacSchema()
  const inheritedSet = await roleDefaultPermissions(platformRole)
  const inherited = Array.from(inheritedSet).sort()

  const grantRows = await sql`
    SELECT permission_code FROM admin_user_permissions
    WHERE admin_user_id = ${adminUserId} AND enabled = true
  `
  const grantCodes = (grantRows as { permission_code: string }[]).map((r) => r.permission_code)
  const additional = grantCodes.filter((c) => !inheritedSet.has(c)).sort()
  const effective = Array.from(new Set([...inherited, ...grantCodes])).sort()

  return { inherited, additional, effective, courseStaffId: null }
}

export async function getFacultyCoursePermissionState(
  instructorId: number,
  courseId: number,
): Promise<UserPermissionGrantState> {
  await ensurePortalRbacSchema()
  const result = await getUserCoursePermissions(instructorId, courseId)
  const staffRole = result.staffRole
  if (!staffRole) {
    return { inherited: [], additional: [], effective: [], courseStaffId: null }
  }

  const inheritedSet = await roleDefaultPermissions(staffRole)
  const inherited = Array.from(inheritedSet).sort()

  let courseStaffId = result.courseStaffId
  if (!courseStaffId) {
    courseStaffId = await ensureCourseStaffRow(courseId, instructorId, staffRole, null)
  }

  const additional: string[] = []
  if (courseStaffId) {
    const overrideRows = await sql`
      SELECT permission_code, enabled FROM course_staff_permissions
      WHERE course_staff_id = ${courseStaffId}
    `
    for (const row of overrideRows as { permission_code: string; enabled: boolean }[]) {
      if (row.enabled && !inheritedSet.has(row.permission_code)) {
        additional.push(row.permission_code)
      }
    }
  }

  additional.sort()
  return {
    inherited,
    additional,
    effective: result.permissions.slice().sort(),
    courseStaffId,
  }
}

export async function setPlatformPermissionGrant(
  adminUserId: number,
  permissionCode: string,
  enabled: boolean,
): Promise<void> {
  await ensurePortalRbacSchema()
  if (enabled) {
    await sql`
      INSERT INTO admin_user_permissions (admin_user_id, permission_code, enabled)
      VALUES (${adminUserId}, ${permissionCode}, true)
      ON CONFLICT (admin_user_id, permission_code) DO UPDATE SET
        enabled = true,
        updated_at = NOW()
    `
  } else {
    await sql`
      DELETE FROM admin_user_permissions
      WHERE admin_user_id = ${adminUserId} AND permission_code = ${permissionCode}
    `
  }
}

export async function setCourseStaffPermissionGrant(
  courseStaffId: number,
  permissionCode: string,
  enabled: boolean,
): Promise<void> {
  await ensurePortalRbacSchema()
  await sql`
    INSERT INTO course_staff_permissions (course_staff_id, permission_code, enabled)
    VALUES (${courseStaffId}, ${permissionCode}, ${enabled})
    ON CONFLICT (course_staff_id, permission_code) DO UPDATE SET
      enabled = EXCLUDED.enabled,
      updated_at = NOW()
  `
}

export async function resolveFacultyCourseStaffId(
  instructorId: number,
  courseId: number,
): Promise<{ courseStaffId: number | null; staffRole: string | null }> {
  const result = await getUserCoursePermissions(instructorId, courseId)
  if (result.courseStaffId) {
    return { courseStaffId: result.courseStaffId, staffRole: result.staffRole }
  }
  if (result.staffRole) {
    const id = await ensureCourseStaffRow(courseId, instructorId, result.staffRole, null)
    return { courseStaffId: id, staffRole: result.staffRole }
  }
  const ownerRows = await sql`
    SELECT id FROM courses
    WHERE id = ${courseId} AND instructor_id = ${instructorId} AND is_active = true
    LIMIT 1
  `
  if (ownerRows.length > 0) {
    const id = await ensureCourseStaffRow(courseId, instructorId, "INSTRUCTOR", null)
    return { courseStaffId: id, staffRole: "INSTRUCTOR" }
  }
  return { courseStaffId: null, staffRole: null }
}

export async function applyPermissionGrant(input: {
  userKind: UserKind
  id: number
  courseId?: number | null
  permissionCode: string
  enabled: boolean
}): Promise<UserPermissionGrantState> {
  const { userKind, id, courseId, permissionCode, enabled } = input

  if (userKind === "platform") {
    const rows = await sql`
      SELECT COALESCE(role, 'PLATFORM_ADMIN') AS role FROM admin_users WHERE id = ${id}
    `
    if (rows.length === 0) throw new Error("Platform user not found")
    const role = (rows[0] as { role: string }).role
    await setPlatformPermissionGrant(id, permissionCode, enabled)
    return getPlatformUserPermissionState(id, role)
  }

  if (userKind === "faculty") {
    if (!courseId) throw new Error("courseId required for faculty grants")
    const { courseStaffId } = await resolveFacultyCourseStaffId(id, courseId)
    if (!courseStaffId) throw new Error("No course assignment for this user")
    await setCourseStaffPermissionGrant(courseStaffId, permissionCode, enabled)
    return getFacultyCoursePermissionState(id, courseId)
  }

  throw new Error("Permission grants not supported for this user type")
}

export async function loadUserPermissionGrantState(input: {
  userKind: UserKind
  id: number
  primaryRole: string
  courseId?: number | null
}): Promise<UserPermissionGrantState | null> {
  const { userKind, id, primaryRole, courseId } = input
  if (userKind === "student") return null

  if (userKind === "platform") {
    return getPlatformUserPermissionState(id, primaryRole)
  }

  if (userKind === "faculty" && courseId) {
    return getFacultyCoursePermissionState(id, courseId)
  }

  return { inherited: [], additional: [], effective: [], courseStaffId: null }
}
