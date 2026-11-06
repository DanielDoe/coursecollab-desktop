import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { resolveGroupProjectCourseScope } from "@/lib/student-course-scope"
import { resolveGroupProjectTermScope } from "@/lib/group-project-term-scope"
import { applyGroupApproval } from "@/lib/groups/apply-group-approval"
import { requireInstructorOrAdminSession } from "@/lib/instructor-session-auth"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const auth = await requireInstructorOrAdminSession(request)
    if (!auth.ok) return auth.response

    const session = request.nextUrl.searchParams.get("session")
    const scope = await resolveGroupProjectCourseScope(request)
    if (!scope.ok) return scope.response
    if (scope.courseId == null) {
      return NextResponse.json({ error: "Select a course to continue." }, { status: 400 })
    }

    const gCourseScope = scope.gCourseScope
    const gTermScope = await resolveGroupProjectTermScope(request, scope.courseId, session)

    const pending = (await sql`
      SELECT g.id, g.name, g.pending_changes
      FROM groups g
      WHERE g.deleted_at IS NULL
        AND g.status IN ('pending', 'pending_update')
        AND (${gCourseScope}) AND (${gTermScope})
      ORDER BY g.created_at ASC
    `) as Array<{ id: number; name: string; pending_changes: unknown }>

    let approved = 0
    const names: string[] = []
    for (const row of pending) {
      await applyGroupApproval(Number(row.id), row.pending_changes as { name?: string; addMembers?: number[]; removeMembers?: number[] } | null)
      approved += 1
      if (row.name) names.push(String(row.name))
    }

    return NextResponse.json({ success: true, approved, names })
  } catch (error) {
    console.error("[groups] approve-all failed:", error)
    return NextResponse.json({ error: "Failed to approve groups" }, { status: 500 })
  }
}
