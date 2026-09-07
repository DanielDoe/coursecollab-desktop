import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireAdminId } from "@/lib/admin-api-auth"
import { ensurePortalRbacSchema } from "@/lib/ensure-portal-rbac-schema"
import { ROLE_HIERARCHY } from "@/lib/roles"

export const dynamic = "force-dynamic"

const ROLE_DESCRIPTIONS: Record<string, string> = {
  PLATFORM_ADMIN: "Owns the entire CourseCollab platform (users, billing, integrations, audit).",
  DEPARTMENT_ADMIN: "Manages academic operations within a department (courses, enrollments, staff assignment).",
  INSTRUCTOR: "Full authority over assigned courses (content, assessments, policies, TAs).",
  TA: "Assists with course operations; capabilities are configured per course by the instructor.",
  COURSE_OBSERVER: "Read-only academic access (content, analytics, assessments, grades). Shown as Observer in the UI.",
  STUDENT: "Learner enrolled in a course.",
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminId(request)
    if (!auth.ok) return auth.response

    await ensurePortalRbacSchema()

    const rows = await sql`
      SELECT role, permission_code FROM role_permissions ORDER BY role, permission_code
    `
    const byRole: Record<string, string[]> = {}
    for (const row of rows as { role: string; permission_code: string }[]) {
      if (!byRole[row.role]) byRole[row.role] = []
      byRole[row.role].push(row.permission_code)
    }

    const roles = ROLE_HIERARCHY.map((code) => ({
      code,
      description: ROLE_DESCRIPTIONS[code] ?? "",
      uiLabel: code === "COURSE_OBSERVER" ? "Observer" : undefined,
      permissions: byRole[code] ?? [],
    }))

    return NextResponse.json({ roles })
  } catch (error) {
    console.error("[admin/users/role-catalog]", error)
    return NextResponse.json({ error: "Failed to load role catalog" }, { status: 500 })
  }
}
