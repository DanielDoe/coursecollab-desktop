import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireInstructorProjectAccess } from "@/lib/project-request-auth"
import { ensureProjectWorkspaceSchema } from "@/lib/ensure-project-workspace-schema"
import { ensureProjectPhase3Schema } from "@/lib/ensure-project-phase3-schema"
import { loadWorkspaceBundle } from "@/lib/projects/project-workspace-service"

export const dynamic = "force-dynamic"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await ensureProjectWorkspaceSchema()
    await ensureProjectPhase3Schema()
    const projectId = Number.parseInt((await params).id, 10)
    const access = await requireInstructorProjectAccess(request, projectId)
    if (!access.ok) return access.response

    const bundle = await loadWorkspaceBundle(projectId)
    if (!bundle) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    const workspaceId = Number(bundle.workspace.id)
    const [contributions, sectionHistory, memberContributions, auditTrail, activity, grading] = await Promise.all([
      sql`
        SELECT s.full_name AS member_name, e.event_type, COUNT(*)::int AS event_count
        FROM project_activity_events e
        LEFT JOIN students s ON s.id = e.actor_student_id
        WHERE e.workspace_id = ${workspaceId}
        GROUP BY s.full_name, e.event_type
        ORDER BY member_name NULLS LAST, e.event_type
      `,
      sql`
        SELECT ws.id AS section_id, ws.title, ws.section_key,
          COUNT(r.id)::int AS revision_count,
          MAX(r.created_at) AS last_edited_at
        FROM project_workspace_sections ws
        LEFT JOIN project_section_revisions r ON r.workspace_section_id = ws.id
        WHERE ws.workspace_id = ${workspaceId}
        GROUP BY ws.id, ws.title, ws.section_key, ws.sort_order
        ORDER BY ws.sort_order ASC
      `,
      sql`
        SELECT s.full_name, e.event_type, COUNT(*)::int AS n
        FROM project_activity_events e
        LEFT JOIN students s ON s.id = e.actor_student_id
        WHERE e.workspace_id = ${workspaceId}
        GROUP BY s.full_name, e.event_type
        ORDER BY s.full_name
      `,
      sql`
        SELECT event_type, comment, payload, created_at
        FROM project_grading_audit_log
        WHERE project_id = ${projectId}
        ORDER BY created_at DESC
        LIMIT 30
      `,
      sql`
        SELECT e.created_at, e.event_type, e.summary,
          COALESCE(s.full_name, i.name, 'Someone') AS actor,
          ws.title AS section_title
        FROM project_activity_events e
        LEFT JOIN students s ON s.id = e.actor_student_id
        LEFT JOIN instructors i ON i.id = e.actor_instructor_id
        LEFT JOIN project_workspace_sections ws ON ws.id = e.workspace_section_id
        WHERE e.workspace_id = ${workspaceId}
        ORDER BY e.created_at DESC
        LIMIT 80
      `,
      sql`
        SELECT a.created_at, a.event_type, a.comment,
          COALESCE(i.name, s.full_name, 'Instructor') AS actor
        FROM project_grading_audit_log a
        LEFT JOIN instructors i ON i.id = a.actor_instructor_id
        LEFT JOIN students s ON s.id = a.actor_student_id
        WHERE a.project_id = ${projectId}
        ORDER BY a.created_at DESC
        LIMIT 40
      `,
    ])

    const timeline = [
      ...(activity as Array<Record<string, unknown>>).map((row) => ({
        at: row.created_at,
        actor: String(row.actor || "Someone"),
        action: String(row.summary || row.event_type || "Updated the report"),
        section: row.section_title ? String(row.section_title) : null,
      })),
      ...(grading as Array<Record<string, unknown>>).map((row) => ({
        at: row.created_at,
        actor: String(row.actor || "Instructor"),
        action: String(row.comment || row.event_type || "Updated the score"),
        section: null,
      })),
    ].sort((a, b) => new Date(String(b.at)).getTime() - new Date(String(a.at)).getTime())

    return NextResponse.json({
      workspaceId,
      submissionStatus: bundle.workspace.submission_status,
      contributions,
      sectionHistory,
      memberContributions,
      auditTrail,
      timeline,
    })
  } catch (error) {
    console.error("[workspace-insights]", error)
    return NextResponse.json({ error: "Failed to load workspace insights" }, { status: 500 })
  }
}
