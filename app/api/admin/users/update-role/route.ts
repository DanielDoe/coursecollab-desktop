import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireAdminId } from "@/lib/admin-api-auth"
import { ensurePortalRbacSchema } from "@/lib/ensure-portal-rbac-schema"
import { ensureInstructorRoleColumns } from "@/lib/ensure-instructor-role-columns"
import { normalizePlatformRole } from "@/lib/roles"
import {
  accountRoleFromPrimaryRole,
  type DirectoryPrimaryRole,
  type UserKind,
} from "@/lib/user-directory"
export const dynamic = "force-dynamic"

const FACULTY_PRIMARY = new Set(["INSTRUCTOR", "TA", "DEPARTMENT_ADMIN", "COURSE_OBSERVER"])
const PLATFORM_PRIMARY = new Set(["PLATFORM_ADMIN", "DEPARTMENT_ADMIN"])

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAdminId(request)
    if (!auth.ok) return auth.response

    await ensurePortalRbacSchema()
    await ensureInstructorRoleColumns()

    const body = await request.json()
    const userKind = body.userKind as UserKind
    const id = Number(body.id)
    const primaryRole = String(body.primaryRole ?? "").toUpperCase() as DirectoryPrimaryRole
    const assignedInstructorId =
      body.assignedInstructorId != null ? Number(body.assignedInstructorId) : null

    if (!userKind || !Number.isFinite(id)) {
      return NextResponse.json({ error: "userKind and id are required" }, { status: 400 })
    }

    if (userKind === "platform") {
      if (!PLATFORM_PRIMARY.has(primaryRole)) {
        return NextResponse.json({ error: "Invalid platform role" }, { status: 400 })
      }
      const role = normalizePlatformRole(primaryRole)
      const updated = await sql`
        UPDATE admin_users SET role = ${role} WHERE id = ${id}
        RETURNING id, username, email, role
      `
      if (updated.length === 0) {
        return NextResponse.json({ error: "Admin user not found" }, { status: 404 })
      }
      return NextResponse.json({ success: true, user: updated[0] })
    }

    if (userKind === "faculty") {
      if (!FACULTY_PRIMARY.has(primaryRole)) {
        return NextResponse.json({ error: "Invalid faculty role" }, { status: 400 })
      }

      let accountRole = accountRoleFromPrimaryRole(primaryRole, "faculty")
      if (primaryRole === "COURSE_OBSERVER") {
        accountRole = "instructor"
      }

      let supervisorId: number | null = null
      if (accountRole === "ta") {
        if (!Number.isFinite(assignedInstructorId)) {
          return NextResponse.json(
            { error: "TAs require a supervising instructor" },
            { status: 400 },
          )
        }
        supervisorId = assignedInstructorId
        const sup = await sql`
          SELECT id FROM instructors
          WHERE id = ${supervisorId} AND COALESCE(role, 'instructor') != 'ta'
          LIMIT 1
        `
        if (sup.length === 0) {
          return NextResponse.json({ error: "Invalid supervising instructor" }, { status: 400 })
        }
      }

      const updated = await sql`
        UPDATE instructors SET
          role = ${accountRole},
          assigned_instructor_id = ${accountRole === "ta" ? supervisorId : null}
        WHERE id = ${id}
        RETURNING id, username, email, name, role, assigned_instructor_id
      `
      if (updated.length === 0) {
        return NextResponse.json({ error: "Faculty account not found" }, { status: 404 })
      }

      // TA course access is assigned explicitly in Users → Teaching Assistants (course_ids).

      return NextResponse.json({ success: true, user: updated[0], note: primaryRole === "COURSE_OBSERVER" ? "Assign Observer on specific courses below." : undefined })
    }

    if (userKind === "student") {
      if (primaryRole !== "STUDENT") {
        return NextResponse.json({ error: "Students cannot be reassigned to staff roles here" }, { status: 400 })
      }
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: "Invalid userKind" }, { status: 400 })
  } catch (error) {
    console.error("[admin/users/update-role]", error)
    return NextResponse.json({ error: "Failed to update role" }, { status: 500 })
  }
}
