import { type NextRequest, NextResponse } from "next/server"
import { sql, asSqlRows } from "@/lib/db"
import { requireCoursePermission } from "@/lib/course-permission-guard"
import { ensureForumModerationSchema } from "@/lib/ensure-forum-moderation-schema"
import { createNotification } from "@/lib/create-notification"

export const dynamic = "force-dynamic"

type ThreadRow = {
  id: number
  student_id: number
  title: string
  description: string
  code_snippet: string | null
  tags: string[] | null
  upvotes: number
  downvotes: number
  reply_count: number
  is_anonymous: boolean
  is_pinned: boolean
  is_resolved: boolean
  created_at: string
  updated_at: string
  author_name: string | null
  author_section: string | null
  author_student_number: string | null
  author_reputation: number
}

type ReplyRow = {
  id: number
  thread_id: number
  reply_text: string
  is_anonymous: boolean
  created_at: string
  author_name: string | null
  author_type: "instructor" | "student"
}

async function threadBelongsToCourse(threadId: number, courseId: number): Promise<boolean> {
  const rows = await sql`
    SELECT t.id
    FROM forum_threads t
    INNER JOIN students s ON s.id = t.student_id
    LEFT JOIN sessions sess ON sess.id = s.session_id
    WHERE t.id = ${threadId}
      AND (s.course_id = ${courseId} OR sess.course_id = ${courseId})
    LIMIT 1
  `
  return rows.length > 0
}

async function loadReplies(threadId: number): Promise<ReplyRow[]> {
  return asSqlRows<ReplyRow>(await sql`
    SELECT
      r.id,
      r.thread_id,
      r.reply_text,
      r.is_anonymous,
      r.created_at,
      CASE
        WHEN r.instructor_id IS NOT NULL THEN COALESCE(i.name, 'Faculty')
        WHEN r.is_anonymous THEN 'Anonymous'
        ELSE COALESCE(s.full_name, 'Student')
      END AS author_name,
      CASE WHEN r.instructor_id IS NOT NULL THEN 'instructor' ELSE 'student' END AS author_type
    FROM forum_replies r
    LEFT JOIN instructors i ON i.id = r.instructor_id
    LEFT JOIN students s ON s.id = r.student_id
    WHERE r.thread_id = ${threadId}
    ORDER BY r.created_at ASC
  `)
}

export async function GET(request: NextRequest) {
  try {
    await ensureForumModerationSchema()
    const gate = await requireCoursePermission(request, ["moderate_discussions"])
    if (!gate.ok) return gate.response

    const { course } = gate
    const sp = request.nextUrl.searchParams
    const threadId = sp.get("threadId")
    const search = sp.get("search")?.trim() ?? ""
    const status = sp.get("status") ?? "all"
    const sortBy = sp.get("sortBy") ?? "recent"

    if (threadId) {
      const id = Number(threadId)
      if (!Number.isFinite(id)) {
        return NextResponse.json({ error: "Invalid threadId" }, { status: 400 })
      }
      if (!(await threadBelongsToCourse(id, course.id))) {
        return NextResponse.json({ error: "Thread not found" }, { status: 404 })
      }

      const threads = asSqlRows<ThreadRow>(await sql`
        SELECT
          t.*,
          CASE WHEN t.is_anonymous THEN 'Anonymous' ELSE s.full_name END AS author_name,
          s.section AS author_section,
          s.student_id AS author_student_number,
          COALESCE(sr.points, 0) AS author_reputation
        FROM forum_threads t
        INNER JOIN students s ON s.id = t.student_id
        LEFT JOIN student_reputation sr ON sr.student_id = t.student_id
        WHERE t.id = ${id}
        LIMIT 1
      `)

      if (threads.length === 0) {
        return NextResponse.json({ error: "Thread not found" }, { status: 404 })
      }

      const replies = await loadReplies(id)
      return NextResponse.json({ thread: threads[0], replies })
    }

    const threads = asSqlRows<ThreadRow>(await sql`
      SELECT
        t.*,
        CASE WHEN t.is_anonymous THEN 'Anonymous' ELSE s.full_name END AS author_name,
        s.section AS author_section,
        s.student_id AS author_student_number,
        COALESCE(sr.points, 0) AS author_reputation
      FROM forum_threads t
      INNER JOIN students s ON s.id = t.student_id
      LEFT JOIN sessions sess ON sess.id = s.session_id
      LEFT JOIN student_reputation sr ON sr.student_id = t.student_id
      WHERE (s.course_id = ${course.id} OR sess.course_id = ${course.id})
        AND (
          ${status} = 'all'
          OR (${status} = 'open' AND t.is_resolved = false)
          OR (${status} = 'resolved' AND t.is_resolved = true)
        )
        AND (
          ${search} = ''
          OR t.title ILIKE ${search ? "%" + search + "%" : "%"}
          OR t.description ILIKE ${search ? "%" + search + "%" : "%"}
        )
      ORDER BY
        t.is_pinned DESC,
        CASE WHEN ${sortBy} = 'popular' THEN (t.upvotes - t.downvotes) END DESC NULLS LAST,
        t.updated_at DESC
      LIMIT 200
    `)

    return NextResponse.json({ threads })
  } catch (error) {
    console.error("[instructor/discussions GET]", error)
    return NextResponse.json({ error: "Failed to load discussions" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureForumModerationSchema()
    const gate = await requireCoursePermission(request, ["moderate_discussions"])
    if (!gate.ok) return gate.response

    const body = (await request.json()) as { thread_id?: number; reply_text?: string }
    const threadId = Number(body.thread_id)
    const replyText = body.reply_text?.trim() ?? ""

    if (!Number.isFinite(threadId) || !replyText) {
      return NextResponse.json({ error: "thread_id and reply_text required" }, { status: 400 })
    }

    if (!(await threadBelongsToCourse(threadId, gate.course.id))) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 })
    }

    const inserted = asSqlRows<{ id: number }>(await sql`
      INSERT INTO forum_replies (thread_id, student_id, instructor_id, reply_text, is_anonymous)
      VALUES (${threadId}, NULL, ${gate.instructorId}, ${replyText}, false)
      RETURNING id
    `)

    await sql`
      UPDATE forum_threads
      SET reply_count = reply_count + 1,
          updated_at = CURRENT_TIMESTAMP,
          is_resolved = false
      WHERE id = ${threadId}
    `

    const threadMeta = await sql`
      SELECT t.title, t.student_id, i.name AS instructor_name
      FROM forum_threads t
      CROSS JOIN instructors i
      WHERE t.id = ${threadId} AND i.id = ${gate.instructorId}
      LIMIT 1
    `

    if (threadMeta.length > 0) {
      const row = threadMeta[0] as { title: string; student_id: number; instructor_name: string }
      await createNotification({
        studentId: row.student_id,
        type: "forum",
        title: "Faculty replied to your discussion",
        message: `${row.instructor_name ?? "Faculty"} replied to "${row.title}"`,
        link: `/student/dashboard-v2/forum?thread=${threadId}`,
      })
    }

    const replies = await loadReplies(threadId)
    return NextResponse.json({ reply_id: inserted[0]?.id ?? null, replies })
  } catch (error) {
    console.error("[instructor/discussions POST]", error)
    return NextResponse.json({ error: "Failed to post reply" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await ensureForumModerationSchema()
    const gate = await requireCoursePermission(request, ["moderate_discussions"])
    if (!gate.ok) return gate.response

    const body = (await request.json()) as {
      thread_id?: number
      is_pinned?: boolean
      is_resolved?: boolean
    }
    const threadId = Number(body.thread_id)
    if (!Number.isFinite(threadId)) {
      return NextResponse.json({ error: "thread_id required" }, { status: 400 })
    }

    if (!(await threadBelongsToCourse(threadId, gate.course.id))) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 })
    }

    if (body.is_pinned !== undefined) {
      await sql`UPDATE forum_threads SET is_pinned = ${body.is_pinned}, updated_at = CURRENT_TIMESTAMP WHERE id = ${threadId}`
    }
    if (body.is_resolved !== undefined) {
      await sql`UPDATE forum_threads SET is_resolved = ${body.is_resolved}, updated_at = CURRENT_TIMESTAMP WHERE id = ${threadId}`
    }

    const threads = asSqlRows<ThreadRow>(await sql`
      SELECT t.*,
        CASE WHEN t.is_anonymous THEN 'Anonymous' ELSE s.full_name END AS author_name,
        s.section AS author_section,
        s.student_id AS author_student_number,
        COALESCE(sr.points, 0) AS author_reputation
      FROM forum_threads t
      INNER JOIN students s ON s.id = t.student_id
      LEFT JOIN student_reputation sr ON sr.student_id = t.student_id
      WHERE t.id = ${threadId}
      LIMIT 1
    `)

    return NextResponse.json({ thread: threads[0] ?? null })
  } catch (error) {
    console.error("[instructor/discussions PATCH]", error)
    return NextResponse.json({ error: "Failed to update thread" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await ensureForumModerationSchema()
    const gate = await requireCoursePermission(request, ["moderate_discussions"])
    if (!gate.ok) return gate.response

    const threadId = Number(request.nextUrl.searchParams.get("threadId"))
    if (!Number.isFinite(threadId)) {
      return NextResponse.json({ error: "threadId required" }, { status: 400 })
    }

    if (!(await threadBelongsToCourse(threadId, gate.course.id))) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 })
    }

    await sql`DELETE FROM forum_replies WHERE thread_id = ${threadId}`
    await sql`DELETE FROM forum_threads WHERE id = ${threadId}`

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[instructor/discussions DELETE]", error)
    return NextResponse.json({ error: "Failed to delete thread" }, { status: 500 })
  }
}
