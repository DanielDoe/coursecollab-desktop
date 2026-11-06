import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireWorkspaceSectionAccess } from "@/lib/projects/project-workspace-auth"
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
      SELECT c.*, s.full_name AS author_name
      FROM project_workspace_comments c
      LEFT JOIN students s ON s.id = c.author_student_id
      WHERE c.workspace_section_id = ${sectionId}
      ORDER BY c.created_at ASC
    `
    return NextResponse.json({ comments: rows })
  } catch (error) {
    return NextResponse.json({ error: "Failed to load comments" }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sectionId: string }> },
) {
  try {
    await ensureProjectWorkspaceSchema()
    const sectionId = Number.parseInt((await params).sectionId, 10)
    const access = await requireWorkspaceSectionAccess(request, sectionId)
    if (!access.ok) return access.response

    const body = await request.json()
    const text = String(body.body || "").trim()
    if (!text) return NextResponse.json({ error: "Comment required" }, { status: 400 })

    const inserted = await sql`
      INSERT INTO project_workspace_comments (
        workspace_section_id, author_student_id, author_instructor_id, body, parent_comment_id
      )
      VALUES (
        ${sectionId},
        ${access.role === "student" ? access.studentDbId : null},
        ${access.role === "instructor" ? null : null},
        ${text},
        ${body.parentCommentId ?? null}
      )
      RETURNING *
    `

    const ws = await sql`
      SELECT workspace_id FROM project_workspace_sections WHERE id = ${sectionId} LIMIT 1
    `
    if (ws.length) {
      await sql`
        INSERT INTO project_activity_events (
          workspace_id, workspace_section_id, event_type, actor_student_id, summary, metadata
        )
        VALUES (
          ${ws[0].workspace_id},
          ${sectionId},
          'COMMENT_ADDED',
          ${access.studentDbId ?? null},
          ${`Comment on section`},
          ${JSON.stringify({ excerpt: text.slice(0, 160) })}::jsonb
        )
      `
    }

    return NextResponse.json({ comment: inserted[0] })
  } catch (error) {
    return NextResponse.json({ error: "Failed to post comment" }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ sectionId: string }> },
) {
  try {
    const sectionId = Number.parseInt((await params).sectionId, 10)
    const access = await requireWorkspaceSectionAccess(request, sectionId)
    if (!access.ok) return access.response

    const body = await request.json()
    const commentId = Number(body.commentId)
    if (!Number.isFinite(commentId)) {
      return NextResponse.json({ error: "commentId required" }, { status: 400 })
    }

    await sql`
      UPDATE project_workspace_comments
      SET resolved_at = NOW(),
          resolved_by_student_id = ${access.studentDbId ?? null},
          updated_at = NOW()
      WHERE id = ${commentId} AND workspace_section_id = ${sectionId}
    `

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Failed to resolve comment" }, { status: 500 })
  }
}
