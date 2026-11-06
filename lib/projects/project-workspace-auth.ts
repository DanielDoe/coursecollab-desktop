import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireProjectMemberOrInstructor, requireInstructorProjectAccess } from "@/lib/project-request-auth"

export async function requireWorkspaceForProject(
  request: NextRequest,
  projectId: number,
) {
  const access = await requireProjectMemberOrInstructor(request, projectId)
  if (!access.ok) return access

  const rows = await sql`
    SELECT w.* FROM project_workspaces w
    WHERE w.project_id = ${projectId}
    LIMIT 1
  `
  return { ...access, workspace: rows[0] as Record<string, unknown> | undefined }
}

export async function requireWorkspaceSectionAccess(
  request: NextRequest,
  workspaceSectionId: number,
) {
  const rows = await sql`
    SELECT ws.*, w.project_id
    FROM project_workspace_sections ws
    JOIN project_workspaces w ON w.id = ws.workspace_id
    WHERE ws.id = ${workspaceSectionId}
    LIMIT 1
  `
  if (rows.length === 0) {
    return { ok: false as const, response: NextResponse.json({ error: "Section not found" }, { status: 404 }) }
  }
  const projectId = Number((rows[0] as { project_id: number }).project_id)
  const access = await requireProjectMemberOrInstructor(request, projectId)
  if (!access.ok) return access
  return {
    ok: true as const,
    section: rows[0] as Record<string, unknown>,
    projectId,
    role: access.role,
    studentDbId: access.studentDbId,
  }
}

export async function requireInstructorWorkspaceProject(request: NextRequest, projectId: number) {
  return requireInstructorProjectAccess(request, projectId)
}
