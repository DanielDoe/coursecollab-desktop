import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireWorkspaceForProject } from "@/lib/projects/project-workspace-auth"
import { loadWorkspaceBundle } from "@/lib/projects/project-workspace-service"
import { buildSubmissionChecklist } from "@/lib/projects/project-submission-workflow"
import { ensureProjectWorkspaceSchema } from "@/lib/ensure-project-workspace-schema"

export const dynamic = "force-dynamic"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    await ensureProjectWorkspaceSchema()
    const { projectId: raw } = await params
    const projectId = Number.parseInt(raw, 10)
    if (!Number.isFinite(projectId)) {
      return NextResponse.json({ error: "Invalid project id" }, { status: 400 })
    }

    const access = await requireWorkspaceForProject(request, projectId)
    if (!access.ok) return access.response

    const bundle = await loadWorkspaceBundle(projectId)
    if (!bundle) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    const workspaceId = Number(bundle.workspace.id)
    const [activity, references, files, confirmations] = await Promise.all([
      sql`
        SELECT e.id, e.event_type, e.summary, e.metadata, e.created_at,
               e.actor_student_id, e.actor_instructor_id, e.workspace_section_id,
               s.full_name AS actor_name,
               ws.title AS section_title
        FROM project_activity_events e
        LEFT JOIN students s ON s.id = e.actor_student_id
        LEFT JOIN project_workspace_sections ws ON ws.id = e.workspace_section_id
        WHERE e.workspace_id = ${workspaceId}
        ORDER BY e.created_at DESC
        LIMIT 80
      `,
      sql`SELECT * FROM project_workspace_references WHERE workspace_id = ${workspaceId} ORDER BY created_at DESC`,
      sql`SELECT * FROM project_workspace_files WHERE workspace_id = ${workspaceId} ORDER BY created_at DESC`,
      sql`SELECT student_id, confirmed_at FROM project_submission_confirmations WHERE workspace_id = ${workspaceId}`,
    ])

    const classmates = await sql`
      SELECT DISTINCT s.id, s.full_name, s.student_id
      FROM students s
      WHERE s.section = (
        SELECT g.session FROM projects p JOIN groups g ON g.id = p.group_id WHERE p.id = ${projectId}
      )
      OR s.id IN (
        SELECT gm.student_id FROM group_members gm
        JOIN projects p ON p.group_id = gm.group_id
        WHERE p.id = ${projectId}
      )
      ORDER BY s.full_name
    `

    let assignment = null
    if (bundle.project.assignment_id) {
      const a = await sql`
        SELECT id, title, description, instructions, submission_mode, submission_workflow
        FROM course_project_assignments WHERE id = ${bundle.project.assignment_id} LIMIT 1
      `
      assignment = a[0] ?? null
    }

    const checklist = await buildSubmissionChecklist(workspaceId, {
      workflow: assignment?.submission_workflow,
      sections: bundle.sections as Array<{
        status?: unknown
        title?: unknown
        config?: unknown
        current_revision?: { content?: { blocks?: import("@/lib/projects/project-template-types").SectionContentBlock[] } } | null
      }>,
    })

    const leaderRows = await sql`
      SELECT g.created_by AS id, s.full_name, s.student_id
      FROM projects p
      JOIN groups g ON g.id = p.group_id
      LEFT JOIN students s ON s.id = g.created_by
      WHERE p.id = ${projectId}
      LIMIT 1
    `
    const leader = leaderRows[0] as { id?: number; full_name?: string; student_id?: string } | undefined
    const members = [...(bundle.members as Array<{ id: number; full_name: string; student_id: string }>)]
    if (leader?.id != null && !members.some((member) => Number(member.id) === Number(leader.id))) {
      members.push({
        id: Number(leader.id),
        full_name: String(leader.full_name || "Group leader"),
        student_id: String(leader.student_id || ""),
      })
    }

    return NextResponse.json({
      ...bundle,
      members,
      leaderId: leader?.id != null ? Number(leader.id) : null,
      viewerId: access.studentDbId ?? null,
      assignment,
      activity,
      references,
      files,
      confirmations,
      checklist,
      classmates,
      role: access.role,
    })
  } catch (error) {
    console.error("[workspace GET]", error)
    return NextResponse.json({ error: "Failed to load workspace" }, { status: 500 })
  }
}
