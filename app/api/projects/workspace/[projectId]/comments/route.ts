import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireWorkspaceForProject } from "@/lib/projects/project-workspace-auth"
import { ensureProjectWorkspaceSchema } from "@/lib/ensure-project-workspace-schema"

export const dynamic = "force-dynamic"

const TOPICS = new Set(["section", "discussion", "assignment", "finished", "general"])

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    await ensureProjectWorkspaceSchema()
    const projectId = Number.parseInt((await params).projectId, 10)
    const access = await requireWorkspaceForProject(request, projectId)
    if (!access.ok) return access.response
    const workspaceId = Number(access.workspace?.id)
    if (!Number.isFinite(workspaceId)) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 })
    }

    const rows = await sql`
      SELECT c.*, s.full_name AS author_name, ws.title AS section_title
      FROM project_workspace_comments c
      LEFT JOIN students s ON s.id = c.author_student_id
      LEFT JOIN project_workspace_sections ws ON ws.id = c.workspace_section_id
      WHERE c.workspace_id = ${workspaceId}
         OR ws.workspace_id = ${workspaceId}
      ORDER BY c.created_at ASC
    `
    return NextResponse.json({ comments: rows })
  } catch (error) {
    console.error("[workspace comments GET]", error)
    return NextResponse.json({ error: "Failed to load comments" }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    await ensureProjectWorkspaceSchema()
    const projectId = Number.parseInt((await params).projectId, 10)
    const access = await requireWorkspaceForProject(request, projectId)
    if (!access.ok) return access.response
    if (!access.workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 })
    const workspaceId = Number(access.workspace.id)

    const body = await request.json()
    const text = String(body.body || "").trim()
    if (!text) return NextResponse.json({ error: "Comment required" }, { status: 400 })
    const topic = String(body.topic || "general")
    if (!TOPICS.has(topic)) return NextResponse.json({ error: "Unknown topic" }, { status: 400 })

    const sectionId = body.sectionId == null || body.sectionId === "" ? null : Number(body.sectionId)
    if (sectionId != null && !Number.isFinite(sectionId)) {
      return NextResponse.json({ error: "Invalid section" }, { status: 400 })
    }
    if ((topic === "section" || topic === "finished") && sectionId == null) {
      return NextResponse.json({ error: "Pick a section" }, { status: 400 })
    }
    if (sectionId != null) {
      const owned = await sql`
        SELECT id FROM project_workspace_sections
        WHERE id = ${sectionId} AND workspace_id = ${workspaceId}
        LIMIT 1
      `
      if (!owned.length) return NextResponse.json({ error: "Section not found" }, { status: 404 })
    }

    const parentId = body.parentCommentId == null ? null : Number(body.parentCommentId)
    if (parentId != null) {
      const parent = await sql`
        SELECT c.id FROM project_workspace_comments c
        LEFT JOIN project_workspace_sections ws ON ws.id = c.workspace_section_id
        WHERE c.id = ${parentId}
          AND (c.workspace_id = ${workspaceId} OR ws.workspace_id = ${workspaceId})
        LIMIT 1
      `
      if (!parent.length) return NextResponse.json({ error: "Thread not found" }, { status: 404 })
    }

    const inserted = await sql`
      INSERT INTO project_workspace_comments (
        workspace_id, workspace_section_id, author_student_id, body, parent_comment_id, topic
      )
      VALUES (
        ${workspaceId},
        ${sectionId},
        ${access.role === "student" ? access.studentDbId : null},
        ${text},
        ${parentId},
        ${topic}
      )
      RETURNING *
    `

    await sql`
      INSERT INTO project_activity_events (
        workspace_id, workspace_section_id, event_type, actor_student_id, summary, metadata
      )
      VALUES (
        ${workspaceId},
        ${sectionId},
        'COMMENT_ADDED',
        ${access.studentDbId ?? null},
        ${parentId ? "Replied in a thread" : "Posted a comment"},
        ${JSON.stringify({ excerpt: text.slice(0, 160), topic })}::jsonb
      )
    `

    return NextResponse.json({ comment: inserted[0] })
  } catch (error) {
    console.error("[workspace comments POST]", error)
    return NextResponse.json({ error: "Failed to post comment" }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    await ensureProjectWorkspaceSchema()
    const projectId = Number.parseInt((await params).projectId, 10)
    const access = await requireWorkspaceForProject(request, projectId)
    if (!access.ok) return access.response
    const workspaceId = Number(access.workspace?.id)
    if (!Number.isFinite(workspaceId)) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 })
    }

    const body = await request.json()
    const commentId = Number(body.commentId)
    if (!Number.isFinite(commentId)) {
      return NextResponse.json({ error: "commentId required" }, { status: 400 })
    }

    const updated = await sql`
      UPDATE project_workspace_comments
      SET resolved_at = NOW(),
          resolved_by_student_id = ${access.studentDbId ?? null},
          updated_at = NOW()
      WHERE id = ${commentId}
        AND parent_comment_id IS NULL
        AND (
          workspace_id = ${workspaceId}
          OR workspace_section_id IN (
            SELECT id FROM project_workspace_sections WHERE workspace_id = ${workspaceId}
          )
        )
      RETURNING id
    `
    if (!updated.length) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[workspace comments PATCH]", error)
    return NextResponse.json({ error: "Failed to resolve comment" }, { status: 500 })
  }
}
