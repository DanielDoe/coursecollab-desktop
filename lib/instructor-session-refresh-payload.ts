import { sql } from "@/lib/db"
import { ensureInstructorRoleColumns } from "@/lib/ensure-instructor-role-columns"
import { ensureTaPermissionColumns } from "@/lib/ensure-ta-permissions-columns"
import type { TaPermissionsStore } from "@/lib/ta-permissions"
import { normalizeCourseStaffRole } from "@/lib/roles"
import {
  ensureFacultyPasswordColumn,
  resolveFacultyPasswordGate,
} from "@/lib/faculty-password"

export type InstructorSessionRefreshPayload = {
  rememberMe: boolean
  instructor: Record<string, unknown>
}

/** Build client session payload after a valid faculty refresh cookie is verified. */
export async function buildInstructorSessionRefreshPayload(params: {
  instructorId: number
  rememberMe: boolean
  universityId?: number | null
}): Promise<InstructorSessionRefreshPayload | null> {
  if (!Number.isFinite(params.instructorId) || params.instructorId <= 0) return null

  await ensureInstructorRoleColumns()
  await ensureTaPermissionColumns()
  await ensureFacultyPasswordColumn()

  const rows = await sql`
    SELECT id, username, email, name, password,
           COALESCE(role, 'instructor') AS role,
           assigned_instructor_id,
           COALESCE(is_active, true) AS is_active,
           COALESCE(has_changed_password, true) AS has_changed_password,
           ta_permissions,
           deleted_at
    FROM instructors
    WHERE id = ${params.instructorId}
    LIMIT 1
  `

  if (rows.length === 0) return null

  const row = rows[0] as {
    id: number
    username: string
    email: string
    name: string
    password: string
    role: string
    assigned_instructor_id: number | null
    is_active: boolean
    has_changed_password: boolean
    ta_permissions: TaPermissionsStore | null
    deleted_at: string | Date | null
  }

  if (!row.is_active || row.deleted_at) return null
  if (row.role === "ta" && !row.assigned_instructor_id) return null

  const assignments = await sql`
    SELECT c.id AS course_id, c.course_code, c.course_title, c.semester, cs.role AS staff_role
    FROM course_staff cs
    INNER JOIN courses c ON c.id = cs.course_id
    WHERE cs.instructor_id = ${row.id}
      AND cs.is_active = true
      AND c.is_active = true
    ORDER BY c.course_title ASC
  `

  const passwordGate = await resolveFacultyPasswordGate({
    instructorId: row.id,
    passwordHash: row.password,
    hasChangedPasswordFlag: row.has_changed_password,
  })

  return {
    rememberMe: params.rememberMe,
    instructor: {
      id: row.id,
      username: row.username,
      email: row.email,
      name: row.name,
      accountType: "faculty",
      role: row.role,
      hasChangedPassword: passwordGate.hasChangedPassword,
      requiresPasswordChange: passwordGate.requiresPasswordChange,
      assignedInstructorId: row.assigned_instructor_id,
      taPermissions: row.ta_permissions ?? {},
      selectedUniversityId:
        params.universityId != null && Number.isFinite(params.universityId)
          ? Math.trunc(params.universityId)
          : undefined,
      loginTime: new Date().toISOString(),
      courseAssignments: (assignments as { staff_role: string }[]).map((a) => ({
        ...a,
        staff_role: normalizeCourseStaffRole(a.staff_role) ?? a.staff_role,
      })),
    },
  }
}
