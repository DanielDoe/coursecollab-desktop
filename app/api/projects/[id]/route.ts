import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireProjectLeaderOrInstructor, requireProjectReadAccess } from "@/lib/project-request-auth"

// GET single project with details
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: projectId } = await params

    const projectIdNum = Number.parseInt(projectId, 10)
    if (isNaN(projectIdNum)) {
      return NextResponse.json({ error: "Invalid project ID - must be a number" }, { status: 400 })
    }

    const access = await requireProjectReadAccess(request, projectIdNum)
    if (!access.ok) return access.response

    const projectResult = await sql`
      SELECT 
        p.id,
        p.group_id,
        p.title,
        p.summary,
        p.deliverables,
        p.target_platform,
        p.project_link,
        p.status,
        p.rejection_reason,
        p.created_at,
        p.updated_at,
        json_build_object(
          'id', g.id,
          'name', g.name,
          'session', g.session,
          'status', g.status,
          'pending_changes', g.pending_changes,
          'created_by', g.created_by
        ) as group,
        json_build_object(
          'id', s.id,
          'full_name', s.full_name,
          'student_id', s.student_id
        ) as leader
      FROM projects p
      JOIN groups g ON p.group_id = g.id
      JOIN students s ON g.created_by = s.id
      WHERE p.id = ${projectIdNum}
    `

    if (projectResult.length === 0) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    return NextResponse.json({ project: projectResult[0] })
  } catch (error) {
    console.error("[v0] Failed to fetch project:", error)
    return NextResponse.json({ error: "Failed to fetch project" }, { status: 500 })
  }
}

// PATCH update project
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: projectId } = await params

    const projectIdNum = Number.parseInt(projectId, 10)
    if (isNaN(projectIdNum)) {
      return NextResponse.json({ error: "Invalid project ID - must be a number" }, { status: 400 })
    }

    const access = await requireProjectLeaderOrInstructor(request, projectIdNum)
    if (!access.ok) return access.response

    const { title, summary, deliverables, targetPlatform, projectLink, studentId } = await request.json()

    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 })
    }


    // Get the project's current state
    const projectCheck = await sql`
      SELECT p.id, p.group_id, p.status, g.created_by
      FROM projects p
      JOIN groups g ON p.group_id = g.id
      WHERE p.id = ${projectIdNum}
    `

    if (projectCheck.length === 0) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    const project = projectCheck[0]

    if (access.role === "student" && studentId && Number(studentId) !== access.studentDbId) {
      return NextResponse.json({ error: "Only the group leader can edit the project" }, { status: 403 })
    }

    // Get current project values to compare
    const currentProject = await sql`
      SELECT title, summary, deliverables, target_platform, project_link, status
      FROM projects
      WHERE id = ${projectIdNum}
    `
    
    const current = currentProject[0]
    
    // Check if only the link is being updated (other fields unchanged)
    const titleChanged = current.title !== title
    const summaryChanged = (current.summary || '') !== (summary || '')
    const deliverablesChanged = (current.deliverables || '') !== (deliverables || '')
    const platformChanged = (current.target_platform || '') !== (targetPlatform || '')
    const linkChanged = (current.project_link || '') !== (projectLink || '')
    
    // If only the link is being updated, keep current status (direct update without approval)
    // Otherwise, if other fields changed, set to pending for approval
    const isLinkOnlyUpdate = linkChanged && !titleChanged && !summaryChanged && !deliverablesChanged && !platformChanged
    const newStatus = isLinkOnlyUpdate ? project.status : 'pending'

    const result = await sql`
      UPDATE projects
      SET 
        title = ${title},
        summary = ${summary || null},
        deliverables = ${deliverables || null},
        target_platform = ${targetPlatform || null},
        project_link = ${projectLink || null},
        status = ${newStatus},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${projectIdNum}
      RETURNING id, group_id, title, summary, deliverables, target_platform, project_link, status, created_at, updated_at
    `

    return NextResponse.json({ project: result[0] })
  } catch (error) {
    console.error("[v0] Failed to update project:", error)
    return NextResponse.json({ error: "Failed to update project" }, { status: 500 })
  }
}

// DELETE project
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: projectId } = await params

    const projectIdNum = Number.parseInt(projectId, 10)
    if (isNaN(projectIdNum)) {
      return NextResponse.json({ error: "Invalid project ID - must be a number" }, { status: 400 })
    }

    const access = await requireProjectLeaderOrInstructor(request, projectIdNum)
    if (!access.ok) return access.response

    let studentId: number | undefined
    try {
      const body = (await request.json()) as { studentId?: number }
      studentId = body?.studentId
    } catch {
      studentId = undefined
    }


    // Get the project's current state
    const projectCheck = await sql`
      SELECT p.id, p.status, g.created_by
      FROM projects p
      JOIN groups g ON p.group_id = g.id
      WHERE p.id = ${projectIdNum}
    `

    if (projectCheck.length === 0) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    const project = projectCheck[0]

    if (access.role === "student" && studentId && Number(studentId) !== access.studentDbId) {
      return NextResponse.json({ error: "Only the group leader can delete the project" }, { status: 403 })
    }

    const result = await sql`
      DELETE FROM projects WHERE id = ${projectIdNum}
      RETURNING id
    `

    if (result.length === 0) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Failed to delete project:", error)
    return NextResponse.json({ error: "Failed to delete project" }, { status: 500 })
  }
}
