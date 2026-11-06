import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireWorkspaceForProject } from "@/lib/projects/project-workspace-auth"
import { ensureProjectWorkspaceSchema } from "@/lib/ensure-project-workspace-schema"
import { loadWorkspaceBundle } from "@/lib/projects/project-workspace-service"

export const dynamic = "force-dynamic"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    await ensureProjectWorkspaceSchema()
    const projectId = Number.parseInt((await params).projectId, 10)
    const access = await requireWorkspaceForProject(request, projectId)
    if (!access.ok) return access.response
    if (access.role !== "student" || !access.studentDbId) {
      return NextResponse.json({ error: "Student access required" }, { status: 403 })
    }

    const bundle = await loadWorkspaceBundle(projectId)
    if (!bundle) return NextResponse.json({ error: "Not found" }, { status: 404 })
    const workspaceId = Number(bundle.workspace.id)

    const body = await request.json()
    const title = String(body.title || "").trim()
    if (!title) return NextResponse.json({ error: "Title required" }, { status: 400 })

    const inserted = await sql`
      INSERT INTO project_workspace_references (
        workspace_id, title, authors, year, source, url, doi, created_by_student_id
      )
      VALUES (
        ${workspaceId},
        ${title},
        ${body.authors ?? null},
        ${body.year == null ? null : Number(body.year)},
        ${body.source ?? null},
        ${body.url ?? null},
        ${body.doi ?? null},
        ${access.studentDbId}
      )
      RETURNING *
    `

    await sql`
      INSERT INTO project_activity_events (
        workspace_id, event_type, actor_student_id, summary
      )
      VALUES (
        ${workspaceId},
        'REFERENCE_ADDED',
        ${access.studentDbId},
        ${`Added reference: ${title}`}
      )
    `

    return NextResponse.json({ reference: inserted[0] })
  } catch (error) {
    console.error("[workspace references POST]", error)
    return NextResponse.json({ error: "Failed to add reference" }, { status: 500 })
  }
}
