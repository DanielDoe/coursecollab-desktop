import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireInstructorProjectAccess } from "@/lib/project-request-auth"
import { ensureProjectPhase3Schema } from "@/lib/ensure-project-phase3-schema"
import { ensureProjectWorkspaceSchema } from "@/lib/ensure-project-workspace-schema"
import { loadGradingConfigForProjectOrLegacy } from "@/lib/projects/load-project-grading-config"
import { loadWorkspaceBundle } from "@/lib/projects/project-workspace-service"
import { readGradingMethodFlags } from "@/lib/projects/project-grading-methods"

export const dynamic = "force-dynamic"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await ensureProjectPhase3Schema()
    await ensureProjectWorkspaceSchema()
    const projectId = Number.parseInt((await params).id, 10)
    const access = await requireInstructorProjectAccess(request, projectId)
    if (!access.ok) return access.response

    const { assignment } = await loadGradingConfigForProjectOrLegacy(projectId)
    const flags = assignment ? readGradingMethodFlags(assignment) : null
    const bundle = await loadWorkspaceBundle(projectId)

    const aiResults = await sql`
      SELECT r.*, run.run_kind, run.scope
      FROM project_ai_grading_results r
      JOIN project_ai_grading_runs run ON run.id = r.run_id
      WHERE r.project_id = ${projectId}
      ORDER BY r.created_at DESC
    `

    const instructorGrades = await sql`
      SELECT * FROM project_instructor_grade_entries WHERE project_id = ${projectId}
    `

    const groups = await sql`
      SELECT p.id, p.title, g.name AS group_name, g.session
      FROM projects p
      JOIN groups g ON g.id = p.group_id
      WHERE p.id = ${projectId}
      LIMIT 1
    `

    const audit = await sql`
      SELECT event_type, comment, payload, created_at
      FROM project_grading_audit_log
      WHERE project_id = ${projectId}
      ORDER BY created_at DESC
      LIMIT 20
    `

    const workspaceId = bundle?.workspace?.id
    const flagsRow = workspaceId
      ? await sql`
          SELECT COUNT(*)::int AS c FROM project_integrity_events
          WHERE workspace_id = ${Number(workspaceId)}
        `
      : []

    return NextResponse.json({
      project: groups[0] ?? null,
      gradingFlags: flags,
      assignment,
      workspace: bundle,
      aiResults,
      instructorGrades,
      audit,
      integrityCount: Number((flagsRow[0] as { c?: number } | undefined)?.c) || 0,
    })
  } catch (error) {
    console.error("[grading-workspace]", error)
    return NextResponse.json({ error: "Failed to load grading workspace" }, { status: 500 })
  }
}
