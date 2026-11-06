import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireWorkspaceForProject } from "@/lib/projects/project-workspace-auth"
import { loadWorkspaceBundle } from "@/lib/projects/project-workspace-service"
import { saveProjectWorkspaceFile } from "@/lib/projects/project-workspace-storage"
import { ensureProjectWorkspaceSchema } from "@/lib/ensure-project-workspace-schema"

export const dynamic = "force-dynamic"
export const maxDuration = 60

const MAX_BYTES = 30 * 1024 * 1024

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

    const form = await request.formData()
    const file = form.get("file") as File | null
    if (!file) return NextResponse.json({ error: "file required" }, { status: 400 })
    if (file.size > MAX_BYTES) return NextResponse.json({ error: "File too large" }, { status: 400 })

    const bundle = await loadWorkspaceBundle(projectId)
    if (!bundle) return NextResponse.json({ error: "Not found" }, { status: 404 })
    const workspaceId = Number(bundle.workspace.id)
    const sectionIdRaw = form.get("workspaceSectionId")
    const workspaceSectionId = sectionIdRaw ? Number(sectionIdRaw) : null
    const evidenceKind = String(form.get("evidenceKind") || "evidence")

    const buffer = Buffer.from(await file.arrayBuffer())
    const stored = await saveProjectWorkspaceFile(workspaceId, file.name, buffer, file.type)

    const inserted = await sql`
      INSERT INTO project_workspace_files (
        workspace_id, workspace_section_id, file_name, storage_url, mime_type, byte_size,
        evidence_kind, uploaded_by_student_id
      )
      VALUES (
        ${workspaceId},
        ${Number.isFinite(workspaceSectionId) ? workspaceSectionId : null},
        ${file.name},
        ${stored.url},
        ${file.type || null},
        ${file.size},
        ${evidenceKind},
        ${access.studentDbId}
      )
      RETURNING *
    `

    await sql`
      INSERT INTO project_activity_events (
        workspace_id, workspace_section_id, event_type, actor_student_id, summary, metadata
      )
      VALUES (
        ${workspaceId},
        ${Number.isFinite(workspaceSectionId) ? workspaceSectionId : null},
        'FILE_UPLOADED',
        ${access.studentDbId},
        ${`Uploaded ${file.name}`},
        ${JSON.stringify({ file_name: file.name })}::jsonb
      )
    `

    return NextResponse.json({ file: inserted[0] })
  } catch (error) {
    console.error("[workspace files POST]", error)
    return NextResponse.json({ error: "Upload failed" }, { status: 500 })
  }
}
