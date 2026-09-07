import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { ensureTaPermissionColumns } from "@/lib/ensure-ta-permissions-columns"
import {
  DEFAULT_TA_PERMISSIONS,
  TA_PERMISSION_KEYS,
  type TaPermissionKey,
  type TaPermissionsStore,
} from "@/lib/ta-permissions"
import { loadInstructorActor } from "@/lib/instructor-actor-scope"
import { requireInstructorFeature } from "@/lib/instructor-membership-guard"
import { syncTaLegacyPermissionsToStaff } from "@/lib/course-staff-sync"
import { ensurePortalRbacSchema } from "@/lib/ensure-portal-rbac-schema"
import { getUserCoursePermissions } from "@/lib/course-permissions"
import {
  buildTaModuleGrantState,
  buildTaNavAccessMap,
  permissionPatchForNavModuleLevel,
  taSetFromEffectivePermissionCodes,
  type TaModuleGrantLevel,
  type TaNavModuleId,
} from "@/lib/ta-nav-access"

export const dynamic = "force-dynamic"

async function requireInstructorOwner(request: NextRequest) {
  const instructorIdRaw = request.headers.get("x-instructor-id")
  if (!instructorIdRaw) {
    return { ok: false as const, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }
  const instructorId = Number(instructorIdRaw)
  const actor = await loadInstructorActor(instructorId)
  if (!actor || actor.role === "ta") {
    return { ok: false as const, response: NextResponse.json({ error: "Instructor access required" }, { status: 403 }) }
  }
  const feature = await requireInstructorFeature(
    instructorId,
    "teachingAssistantManagement",
    "Teaching assistant management requires Instructor Teams.",
  )
  if (!feature.ok) return feature
  return { ok: true as const, instructorId, actor }
}

async function loadTaForSupervisor(taId: number, supervisorId: number) {
  const taRows = await sql`
    SELECT id, name, username, ta_permissions
    FROM instructors
    WHERE id = ${taId} AND COALESCE(role, 'instructor') = 'ta'
      AND assigned_instructor_id = ${supervisorId}
    LIMIT 1
  `
  if (taRows.length === 0) return null
  return taRows[0] as {
    id: number
    name: string
    username: string
    ta_permissions: TaPermissionsStore | null
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireInstructorOwner(request)
    if (!auth.ok) return auth.response

    const { searchParams } = new URL(request.url)
    const taId = Number(searchParams.get("taId"))
    const courseId = Number(searchParams.get("courseId"))
    if (!Number.isFinite(taId) || !Number.isFinite(courseId)) {
      return NextResponse.json({ error: "taId and courseId required" }, { status: 400 })
    }

    const course = await sql`
      SELECT id FROM courses WHERE id = ${courseId} AND instructor_id = ${auth.instructorId} LIMIT 1
    `
    if (course.length === 0) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 })
    }

    const ta = await loadTaForSupervisor(taId, auth.instructorId)
    if (!ta) {
      return NextResponse.json({ error: "TA not found for this instructor" }, { status: 404 })
    }

    await ensurePortalRbacSchema()
    const { permissions: rbacCodes } = await getUserCoursePermissions(taId, courseId)
    const effective = taSetFromEffectivePermissionCodes(rbacCodes)
    const navAccess = buildTaNavAccessMap(rbacCodes)
    const moduleGrants = buildTaModuleGrantState(rbacCodes)

    return NextResponse.json({
      ta: { id: ta.id, name: ta.name, username: ta.username },
      courseId,
      defaults: { ...DEFAULT_TA_PERMISSIONS },
      effective,
      rbacCodes,
      navAccess,
      moduleGrants,
      keys: TA_PERMISSION_KEYS,
    })
  } catch (error) {
    console.error("[instructor/ta-permissions GET]", error)
    return NextResponse.json({ error: "Failed to load TA permissions" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireInstructorOwner(request)
    if (!auth.ok) return auth.response

    await ensureTaPermissionColumns()

    const body = await request.json()
    const taId = Number(body.taId)
    const courseId = Number(body.courseId)
    let permissions = body.permissions as Partial<Record<TaPermissionKey, boolean>> | undefined

    if (body.navModule && typeof body.enabled === "boolean") {
      const moduleId = body.navModule as TaNavModuleId
      const level: TaModuleGrantLevel = body.level === "publish" ? "publish" : "crud"
      permissions = {
        ...permissions,
        ...permissionPatchForNavModuleLevel(moduleId, level, body.enabled),
      }
    }

    if (!Number.isFinite(taId) || !Number.isFinite(courseId)) {
      return NextResponse.json({ error: "taId and courseId required" }, { status: 400 })
    }
    if (!permissions || Object.keys(permissions).length === 0) {
      return NextResponse.json({ error: "permissions or navModule required" }, { status: 400 })
    }

    const course = await sql`
      SELECT id FROM courses WHERE id = ${courseId} AND instructor_id = ${auth.instructorId} LIMIT 1
    `
    if (course.length === 0) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 })
    }

    const taRows = await sql`
      SELECT ta_permissions
      FROM instructors
      WHERE id = ${taId} AND COALESCE(role, 'instructor') = 'ta'
        AND assigned_instructor_id = ${auth.instructorId}
      LIMIT 1
    `
    if (taRows.length === 0) {
      return NextResponse.json({ error: "TA not found" }, { status: 404 })
    }

    const existing = (taRows[0].ta_permissions as TaPermissionsStore) ?? {}
    const byCourse = { ...(existing.byCourse ?? {}) }
    byCourse[String(courseId)] = { ...(byCourse[String(courseId)] ?? {}), ...permissions }

    await sql`
      UPDATE instructors SET ta_permissions = ${JSON.stringify({ byCourse })}::jsonb
      WHERE id = ${taId}
    `

    await syncTaLegacyPermissionsToStaff(
      taId,
      courseId,
      "TA",
      auth.instructorId,
      { byCourse },
      permissions,
    )

    const { permissions: rbacCodes } = await getUserCoursePermissions(taId, courseId)
    const effective = taSetFromEffectivePermissionCodes(rbacCodes)
    const navAccess = buildTaNavAccessMap(rbacCodes)
    const moduleGrants = buildTaModuleGrantState(rbacCodes)

    return NextResponse.json({ success: true, effective, rbacCodes, navAccess, moduleGrants })
  } catch (error) {
    console.error("[instructor/ta-permissions PATCH]", error)
    return NextResponse.json({ error: "Failed to save TA permissions" }, { status: 500 })
  }
}
