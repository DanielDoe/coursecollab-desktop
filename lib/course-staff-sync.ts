import { sql } from "@/lib/db"
import { ensurePortalRbacSchema } from "@/lib/ensure-portal-rbac-schema"
import { ensurePortalRbacSeed } from "@/lib/ensure-portal-rbac-seed"
import { PERMISSION_CODE_TO_TA_KEY, TA_KEY_TO_PERMISSION_CODE } from "@/lib/rbac-permission-codes"
import {
  DEFAULT_TA_PERMISSIONS,
  mergeTaPermissions,
  TA_PERMISSION_KEYS,
  type TaPermissionKey,
  type TaPermissionsStore,
} from "@/lib/ta-permissions"

/** Ensure course_staff row exists for a TA on a course */
export async function ensureCourseStaffRow(
  courseId: number,
  instructorId: number,
  role: string,
  assignedBy?: number | null,
): Promise<number | null> {
  await ensurePortalRbacSchema()
  if (role === "INSTRUCTOR" || role === "TA" || role === "COURSE_OBSERVER") {
    await ensurePortalRbacSeed()
  }
  const rows = await sql`
    INSERT INTO course_staff (course_id, instructor_id, role, assigned_by)
    VALUES (${courseId}, ${instructorId}, ${role}, ${assignedBy ?? null})
    ON CONFLICT (course_id, instructor_id) DO UPDATE SET
      role = EXCLUDED.role,
      assigned_by = COALESCE(EXCLUDED.assigned_by, course_staff.assigned_by),
      is_active = true,
      updated_at = NOW()
    RETURNING id
  `
  return rows.length > 0 ? Number(rows[0].id) : null
}

/** Sync legacy JSON overrides + explicit toggles into course_staff_permissions */
export async function syncCourseStaffPermissions(
  courseStaffId: number,
  permissions: Partial<Record<TaPermissionKey, boolean>>,
): Promise<void> {
  await ensurePortalRbacSchema()
  for (const [key, enabled] of Object.entries(permissions)) {
    if (typeof enabled !== "boolean") continue
    const code = TA_KEY_TO_PERMISSION_CODE[key]
    if (!code) continue
    await sql`
      INSERT INTO course_staff_permissions (course_staff_id, permission_code, enabled)
      VALUES (${courseStaffId}, ${code}, ${enabled})
      ON CONFLICT (course_staff_id, permission_code) DO UPDATE SET
        enabled = EXCLUDED.enabled,
        updated_at = NOW()
    `
  }
}

export async function syncTaLegacyPermissionsToStaff(
  taId: number,
  courseId: number,
  staffRole: string,
  assignedBy: number | null,
  stored?: TaPermissionsStore | null,
  patch?: Partial<Record<TaPermissionKey, boolean>>,
): Promise<void> {
  const staffId = await ensureCourseStaffRow(courseId, taId, staffRole, assignedBy)
  if (!staffId) return

  const merged: Partial<Record<TaPermissionKey, boolean>> = { ...patch }
  const overrides = stored?.byCourse?.[String(courseId)]
  if (overrides) {
    for (const [k, v] of Object.entries(overrides)) {
      if (typeof v === "boolean") merged[k as TaPermissionKey] = v
    }
  }
  if (patch) Object.assign(merged, patch)

  if (Object.keys(merged).length > 0) {
    await syncCourseStaffPermissions(staffId, merged)
  }
}

function normalizeCourseIdList(courseIds: unknown): number[] {
  if (!Array.isArray(courseIds)) return []
  const out = new Set<number>()
  for (const raw of courseIds) {
    const n = Number(raw)
    if (Number.isFinite(n) && n > 0) out.add(Math.trunc(n))
  }
  return [...out]
}

/** Validate course ids belong to the supervising instructor's active courses. */
export async function validateTaCourseIdsForSupervisor(
  supervisorId: number,
  courseIds: number[],
): Promise<{ ok: true; courseIds: number[] } | { ok: false; error: string }> {
  if (courseIds.length === 0) {
    return { ok: false, error: "Select at least one course for this teaching assistant" }
  }
  const rows = await sql`
    SELECT id FROM courses
    WHERE instructor_id = ${supervisorId}
      AND is_active = true
      AND id = ANY(${courseIds}::int[])
  `
  const valid = (rows as { id: number }[]).map((r) => Number(r.id))
  if (valid.length !== courseIds.length) {
    return {
      ok: false,
      error: "One or more courses are invalid or not owned by the supervising instructor",
    }
  }
  return { ok: true, courseIds: valid }
}

/**
 * Set TA course access to exactly the selected courses (not all supervisor courses).
 * Deactivates prior course_staff rows that are no longer selected.
 */
export async function replaceTaCourseStaffAssignments(
  taId: number,
  supervisorId: number,
  courseIds: unknown,
): Promise<void> {
  await ensurePortalRbacSchema()
  const parsed = normalizeCourseIdList(courseIds)
  const check = await validateTaCourseIdsForSupervisor(supervisorId, parsed)
  if (!check.ok) throw new Error(check.error)

  await sql`
    UPDATE course_staff
    SET is_active = false, updated_at = NOW()
    WHERE instructor_id = ${taId}
      AND NOT (course_id = ANY(${check.courseIds}::int[]))
  `

  const taRows = await sql`
    SELECT ta_permissions FROM instructors WHERE id = ${taId} LIMIT 1
  `
  const stored =
    taRows.length > 0
      ? ((taRows[0] as { ta_permissions: TaPermissionsStore | null }).ta_permissions ?? null)
      : null

  for (const courseId of check.courseIds) {
    await ensureCourseStaffRow(courseId, taId, "TA", supervisorId)
    await syncTaInitialStaffPermissions(taId, courseId, supervisorId, stored)
  }
}

/** Seed explicit course_staff_permissions from TA defaults + legacy JSON overrides. */
export async function syncTaInitialStaffPermissions(
  taId: number,
  courseId: number,
  supervisorId: number,
  stored?: TaPermissionsStore | null,
): Promise<void> {
  const staffId = await ensureCourseStaffRow(courseId, taId, "TA", supervisorId)
  if (!staffId) return
  const merged = mergeTaPermissions(stored, courseId)
  const patch: Partial<Record<TaPermissionKey, boolean>> = {}
  for (const key of TA_PERMISSION_KEYS) {
    patch[key] = merged[key]
  }
  await syncCourseStaffPermissions(staffId, patch)
}

/** @deprecated Use replaceTaCourseStaffAssignments with explicit course_ids */
export async function syncTaCourseStaffAssignments(
  taId: number,
  supervisorId: number,
  courseIds?: unknown,
): Promise<void> {
  if (courseIds != null) {
    await replaceTaCourseStaffAssignments(taId, supervisorId, courseIds)
    return
  }
  const courses = await sql`
    SELECT id FROM courses WHERE instructor_id = ${supervisorId} AND is_active = true
  `
  await replaceTaCourseStaffAssignments(
    taId,
    supervisorId,
    (courses as { id: number }[]).map((r) => r.id),
  )
}

export async function loadCourseStaffPermissionOverrides(
  courseStaffId: number,
): Promise<Partial<Record<TaPermissionKey, boolean>>> {
  await ensurePortalRbacSchema()
  const rows = await sql`
    SELECT permission_code, enabled FROM course_staff_permissions
    WHERE course_staff_id = ${courseStaffId}
  `
  const out: Partial<Record<TaPermissionKey, boolean>> = {}
  for (const row of rows as { permission_code: string; enabled: boolean }[]) {
    const key = PERMISSION_CODE_TO_TA_KEY[row.permission_code] as TaPermissionKey | undefined
    if (key) out[key] = row.enabled
  }
  return out
}
