import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireAdminId } from "@/lib/admin-api-auth"
import { ensurePortalRbacSchema } from "@/lib/ensure-portal-rbac-schema"
import { getUserCoursePermissions } from "@/lib/course-permissions"
import { getPlatformPermissions } from "@/lib/platform-permissions"
import { getPlatformUserPermissionState } from "@/lib/permission-grants"
import type { TaPermissionKey } from "@/lib/ta-permissions"
import { loadCourseStaffPermissionOverrides } from "@/lib/course-staff-sync"
import type { UserKind } from "@/lib/user-directory"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminId(request)
    if (!auth.ok) return auth.response

    await ensurePortalRbacSchema()

    const { searchParams } = new URL(request.url)
    const userKind = searchParams.get("userKind") as UserKind
    const id = Number(searchParams.get("id"))
    const courseId = searchParams.get("courseId") ? Number(searchParams.get("courseId")) : null

    if (!userKind || !Number.isFinite(id)) {
      return NextResponse.json({ error: "userKind and id required" }, { status: 400 })
    }

    if (userKind === "platform") {
      const rows = await sql`
        SELECT id, username, email, COALESCE(role, 'PLATFORM_ADMIN') AS role FROM admin_users WHERE id = ${id}
      `
      if (rows.length === 0) {
        return NextResponse.json({ error: "Not found" }, { status: 404 })
      }
      const admin = rows[0] as { role: string }
      const { permissions } = await getPlatformPermissions(admin.role, id)
      const state = await getPlatformUserPermissionState(id, admin.role)
      return NextResponse.json({
        inheritedPermissions: state.inherited,
        additionalPermissions: state.additional,
        effectivePermissions: permissions,
        overrides: state.additional,
        coursePermissions: null,
      })
    }

    if (userKind === "faculty" && courseId != null) {
      const result = await getUserCoursePermissions(id, courseId)
      let taOverrides: Partial<Record<TaPermissionKey, boolean>> = {}
      if (result.courseStaffId) {
        taOverrides = await loadCourseStaffPermissionOverrides(result.courseStaffId)
      }
      return NextResponse.json({
        staffRole: result.staffRole,
        inheritedPermissions: result.permissions,
        taOverrides,
        courseStaffId: result.courseStaffId,
      })
    }

    if (userKind === "student") {
      return NextResponse.json({
        inheritedPermissions: [],
        overrides: [],
        note: "Students use the Student role with course enrollment — no staff permissions.",
      })
    }

    return NextResponse.json({ inheritedPermissions: [], overrides: [] })
  } catch (error) {
    console.error("[admin/users/detail]", error)
    return NextResponse.json({ error: "Failed to load user detail" }, { status: 500 })
  }
}
