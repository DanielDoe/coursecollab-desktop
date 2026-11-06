import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireInstructorProjectAccess } from "@/lib/project-request-auth"
import { getOrCreateWorkspace } from "@/lib/projects/project-workspace-service"

export const dynamic = "force-dynamic"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const projectId = Number.parseInt((await params).id, 10)
    const access = await requireInstructorProjectAccess(request, projectId)
    if (!access.ok) return access.response

    const rows = await sql`
      SELECT assignment_id FROM projects WHERE id = ${projectId} LIMIT 1
    `
    return NextResponse.json({ assignmentId: rows[0]?.assignment_id ?? null })
  } catch (error) {
    console.error("[link assignment GET]", error)
    return NextResponse.json({ error: "Failed to load assignment link" }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const projectId = Number.parseInt((await params).id, 10)
    const access = await requireInstructorProjectAccess(request, projectId)
    if (!access.ok) return access.response

    const body = await request.json()
    const assignmentId = body.assignmentId == null ? null : Number(body.assignmentId)
    if (assignmentId != null && !Number.isFinite(assignmentId)) {
      return NextResponse.json({ error: "Invalid assignmentId" }, { status: 400 })
    }

    if (assignmentId != null) {
      const a = await sql`
        SELECT id FROM course_project_assignments
        WHERE id = ${assignmentId} AND course_id = (
          SELECT g.course_id FROM projects p JOIN groups g ON g.id = p.group_id WHERE p.id = ${projectId}
        )
        LIMIT 1
      `
      if (a.length === 0) {
        return NextResponse.json({ error: "Assignment not in project course" }, { status: 403 })
      }
    }

    await sql`
      UPDATE projects SET assignment_id = ${assignmentId} WHERE id = ${projectId}
    `

    if (assignmentId != null) {
      await getOrCreateWorkspace(projectId, assignmentId)
    }

    return NextResponse.json({ success: true, assignmentId })
  } catch (error) {
    console.error("[link assignment]", error)
    return NextResponse.json({ error: "Failed to link assignment" }, { status: 500 })
  }
}
