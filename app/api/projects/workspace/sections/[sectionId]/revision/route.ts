import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireWorkspaceSectionAccess } from "@/lib/projects/project-workspace-auth"
import { saveSectionRevision } from "@/lib/projects/project-workspace-service"
import type { ProjectSectionRevisionContent } from "@/lib/projects/project-template-types"
import { ensureProjectWorkspaceSchema } from "@/lib/ensure-project-workspace-schema"

export const dynamic = "force-dynamic"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sectionId: string }> },
) {
  try {
    await ensureProjectWorkspaceSchema()
    const sectionId = Number.parseInt((await params).sectionId, 10)
    const access = await requireWorkspaceSectionAccess(request, sectionId)
    if (!access.ok) return access.response

    const rows = await sql`
      SELECT r.id, r.revision_number, r.change_summary, r.created_at,
        r.created_by_student_id, s.full_name AS author_name
      FROM project_section_revisions r
      LEFT JOIN students s ON s.id = r.created_by_student_id
      WHERE r.workspace_section_id = ${sectionId}
      ORDER BY r.revision_number DESC
      LIMIT 25
    `
    return NextResponse.json({ revisions: rows })
  } catch (error) {
    console.error("[section revision GET]", error)
    return NextResponse.json({ error: "Failed to load revisions" }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ sectionId: string }> },
) {
  try {
    const { sectionId: raw } = await params
    const sectionId = Number.parseInt(raw, 10)
    if (!Number.isFinite(sectionId)) {
      return NextResponse.json({ error: "Invalid section id" }, { status: 400 })
    }

    const access = await requireWorkspaceSectionAccess(request, sectionId)
    if (!access.ok) return access.response

    const body = await request.json()
    const content = (body.content ?? { blocks: [] }) as ProjectSectionRevisionContent
    const changeSummary = String(body.changeSummary || "Updated section content")

    const result = await saveSectionRevision({
      workspaceSectionId: sectionId,
      content,
      studentId: access.role === "student" ? access.studentDbId : null,
      instructorId: access.role === "instructor" ? undefined : null,
      changeSummary,
      activityType: body.markComplete ? "SECTION_COMPLETED" : "SECTION_EDITED",
    })

    if (body.markComplete && access.studentDbId) {
      const { markSectionComplete } = await import("@/lib/projects/project-workspace-service")
      await markSectionComplete(sectionId, access.studentDbId)
    }

    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error("[section revision PUT]", error)
    return NextResponse.json({ error: "Failed to save section" }, { status: 500 })
  }
}
