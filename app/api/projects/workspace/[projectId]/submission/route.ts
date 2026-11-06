import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireWorkspaceForProject } from "@/lib/projects/project-workspace-auth"
import { loadWorkspaceBundle } from "@/lib/projects/project-workspace-service"
import { buildSubmissionChecklist } from "@/lib/projects/project-submission-workflow"
import { loadGradingConfigForProjectOrLegacy } from "@/lib/projects/load-project-grading-config"

export const dynamic = "force-dynamic"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const projectId = Number.parseInt((await params).projectId, 10)
    const access = await requireWorkspaceForProject(request, projectId)
    if (!access.ok) return access.response
    if (access.role !== "student" || !access.studentDbId) {
      return NextResponse.json({ error: "Student access required" }, { status: 403 })
    }

    const body = await request.json()
    const action = String(body.action || "")

    const bundle = await loadWorkspaceBundle(projectId)
    if (!bundle) return NextResponse.json({ error: "Not found" }, { status: 404 })
    const workspaceId = Number(bundle.workspace.id)

    if (action === "confirm") {
      await sql`
        INSERT INTO project_submission_confirmations (workspace_id, student_id)
        VALUES (${workspaceId}, ${access.studentDbId})
        ON CONFLICT (workspace_id, student_id) DO UPDATE SET confirmed_at = NOW()
      `
      await sql`
        UPDATE project_workspaces SET submission_status = 'GROUP_CONFIRMATION', updated_at = NOW()
        WHERE id = ${workspaceId}
      `
      return NextResponse.json({ success: true, status: "GROUP_CONFIRMATION" })
    }

    if (action === "submit") {
      let workflowRaw: unknown = {}
      if (bundle.project.assignment_id) {
        const a = await sql`
          SELECT submission_workflow FROM course_project_assignments WHERE id = ${bundle.project.assignment_id}
        `
        workflowRaw = a[0]?.submission_workflow ?? {}
      }
      const checklist = await buildSubmissionChecklist(workspaceId, {
        workflow: workflowRaw,
        sections: bundle.sections as Array<{
          status?: unknown
          title?: unknown
          config?: unknown
          current_revision?: { content?: { blocks?: import("@/lib/projects/project-template-types").SectionContentBlock[] } } | null
        }>,
      })
      const blocked = checklist.filter((item) => !item.ok)
      if (blocked.length > 0) {
        return NextResponse.json({ error: "Checklist incomplete", checklist }, { status: 400 })
      }

      const leaderRows = await sql`
        SELECT g.created_by
        FROM projects p
        JOIN groups g ON g.id = p.group_id
        WHERE p.id = ${projectId}
        LIMIT 1
      `
      const leaderId = Number(leaderRows[0]?.created_by)
      if (leaderId !== access.studentDbId) {
        return NextResponse.json({ error: "Only the group leader can submit the project" }, { status: 403 })
      }

      const members = await sql`
        SELECT s.id, s.full_name
        FROM group_members gm
        JOIN students s ON s.id = gm.student_id
        JOIN projects p ON p.group_id = gm.group_id
        WHERE p.id = ${projectId}
        UNION
        SELECT s.id, s.full_name
        FROM students s
        WHERE s.id = ${leaderId}
      `
      const confirmed = await sql`
        SELECT student_id FROM project_submission_confirmations WHERE workspace_id = ${workspaceId}
      `
      const confirmedIds = new Set(confirmed.map((row) => Number(row.student_id)))
      const missing = members
        .filter((member) => !confirmedIds.has(Number(member.id)))
        .map((member) => String(member.full_name || "Member"))
      if (missing.length > 0) {
        return NextResponse.json(
          { error: "Every group member must confirm their part before submit", missing },
          { status: 400 },
        )
      }

      await sql`
        UPDATE project_workspaces
        SET submission_status = 'SUBMITTED', submitted_at = NOW(), updated_at = NOW()
        WHERE id = ${workspaceId}
      `
      await sql`
        INSERT INTO project_activity_events (workspace_id, event_type, actor_student_id, summary)
        VALUES (${workspaceId}, 'SUBMISSION_STATUS_CHANGED', ${access.studentDbId}, 'Group project submitted')
      `
      const { assignment } = await loadGradingConfigForProjectOrLegacy(projectId)
      if (assignment?.ai_grading_settings?.auto_run_on_submit) {
        const { applyProvisionalAiGrades } = await import("@/lib/projects/project-auto-ai-grade")
        void applyProvisionalAiGrades(projectId).catch((error) => {
          console.error("[workspace submission] provisional AI grade", error)
        })
      }
      return NextResponse.json({ success: true, status: "SUBMITTED" })
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  } catch (error) {
    console.error("[workspace submission]", error)
    return NextResponse.json({ error: "Submission failed" }, { status: 500 })
  }
}
