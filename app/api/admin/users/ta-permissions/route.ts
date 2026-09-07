import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireAdminId } from "@/lib/admin-api-auth"
import {
  DEFAULT_TA_PERMISSIONS,
  mergeTaPermissions,
  TA_PERMISSION_KEYS,
  type TaPermissionKey,
  type TaPermissionsStore,
} from "@/lib/ta-permissions"
import {
  loadCourseStaffPermissionOverrides,
  syncTaLegacyPermissionsToStaff,
} from "@/lib/course-staff-sync"
import { ensurePortalRbacSchema } from "@/lib/ensure-portal-rbac-schema"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminId(request)
    if (!auth.ok) return auth.response

    const taId = Number(new URL(request.url).searchParams.get("taId"))
    const courseId = Number(new URL(request.url).searchParams.get("courseId"))
    if (!Number.isFinite(taId) || !Number.isFinite(courseId)) {
      return NextResponse.json({ error: "taId and courseId required" }, { status: 400 })
    }

    const taRows = await sql`
      SELECT id, name, username, ta_permissions
      FROM instructors WHERE id = ${taId} AND COALESCE(role, 'instructor') = 'ta' LIMIT 1
    `
    if (taRows.length === 0) {
      return NextResponse.json({ error: "TA not found" }, { status: 404 })
    }

    const ta = taRows[0] as { ta_permissions: TaPermissionsStore | null }
    let effective = mergeTaPermissions(ta.ta_permissions, courseId)
    await ensurePortalRbacSchema()
    const staffRows = await sql`
      SELECT id FROM course_staff
      WHERE course_id = ${courseId} AND instructor_id = ${taId} AND is_active = true LIMIT 1
    `
    if (staffRows.length > 0) {
      const dbOverrides = await loadCourseStaffPermissionOverrides(Number(staffRows[0].id))
      effective = { ...effective, ...dbOverrides }
    }

    return NextResponse.json({
      defaults: { ...DEFAULT_TA_PERMISSIONS },
      effective,
      keys: TA_PERMISSION_KEYS,
    })
  } catch (error) {
    console.error("[admin/users/ta-permissions GET]", error)
    return NextResponse.json({ error: "Failed to load permissions" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAdminId(request)
    if (!auth.ok) return auth.response

    const body = await request.json()
    const taId = Number(body.taId)
    const courseId = Number(body.courseId)
    const permissions = body.permissions as Partial<Record<TaPermissionKey, boolean>>

    if (!Number.isFinite(taId) || !Number.isFinite(courseId)) {
      return NextResponse.json({ error: "taId and courseId required" }, { status: 400 })
    }

    const taRows = await sql`
      SELECT ta_permissions, assigned_instructor_id
      FROM instructors WHERE id = ${taId} AND COALESCE(role, 'instructor') = 'ta' LIMIT 1
    `
    if (taRows.length === 0) {
      return NextResponse.json({ error: "TA not found" }, { status: 404 })
    }

    const existing = (taRows[0].ta_permissions as TaPermissionsStore) ?? {}
    const byCourse = { ...(existing.byCourse ?? {}) }
    byCourse[String(courseId)] = { ...(byCourse[String(courseId)] ?? {}), ...permissions }

    await sql`
      UPDATE instructors SET ta_permissions = ${JSON.stringify({ byCourse })}::jsonb WHERE id = ${taId}
    `

    const supervisorId = (taRows[0] as { assigned_instructor_id: number | null }).assigned_instructor_id
    await syncTaLegacyPermissionsToStaff(
      taId,
      courseId,
      "TA",
      supervisorId,
      { byCourse },
      permissions,
    )

    return NextResponse.json({
      success: true,
      effective: mergeTaPermissions({ byCourse }, courseId),
    })
  } catch (error) {
    console.error("[admin/users/ta-permissions PATCH]", error)
    return NextResponse.json({ error: "Failed to save permissions" }, { status: 500 })
  }
}
