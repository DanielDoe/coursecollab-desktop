import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireWorkspaceForProject } from "@/lib/projects/project-workspace-auth"
import { loadWorkspaceBundle } from "@/lib/projects/project-workspace-service"
import { deleteProjectWorkspaceBlob } from "@/lib/projects/project-workspace-storage"
import { ensureProjectWorkspaceSchema } from "@/lib/ensure-project-workspace-schema"

export const dynamic = "force-dynamic"

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; fileId: string }> },
) {
  try {
    await ensureProjectWorkspaceSchema()
    const { projectId: projectIdRaw, fileId: fileIdRaw } = await params
    const projectId = Number.parseInt(projectIdRaw, 10)
    const fileId = Number.parseInt(fileIdRaw, 10)
    if (!Number.isFinite(projectId) || !Number.isFinite(fileId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 })
    }

    const access = await requireWorkspaceForProject(request, projectId)
    if (!access.ok) return access.response
    if (access.role !== "student" && access.role !== "instructor" && access.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const bundle = await loadWorkspaceBundle(projectId)
    if (!bundle) return NextResponse.json({ error: "Not found" }, { status: 404 })
    const workspaceId = Number(bundle.workspace.id)

    const rows = await sql`
      SELECT id, file_name, storage_url
      FROM project_workspace_files
      WHERE id = ${fileId} AND workspace_id = ${workspaceId}
      LIMIT 1
    `
    const file = rows[0] as { id: number; file_name: string; storage_url: string } | undefined
    if (!file) return NextResponse.json({ error: "File not found" }, { status: 404 })

    await sql`
      DELETE FROM project_workspace_files
      WHERE id = ${fileId} AND workspace_id = ${workspaceId}
    `
    await deleteProjectWorkspaceBlob(file.storage_url)

    await sql`
      INSERT INTO project_activity_events (
        workspace_id, event_type, actor_student_id, summary, metadata
      )
      VALUES (
        ${workspaceId},
        'FILE_DELETED',
        ${access.studentDbId ?? null},
        ${`Removed ${file.file_name}`},
        ${JSON.stringify({ file_name: file.file_name })}::jsonb
      )
    `

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[workspace files DELETE]", error)
    return NextResponse.json({ error: "Delete failed" }, { status: 500 })
  }
}
