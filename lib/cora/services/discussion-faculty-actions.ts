import { sql, asSqlRows } from "@/lib/db"
import { ensureForumModerationSchema } from "@/lib/ensure-forum-moderation-schema"
import { createNotification } from "@/lib/create-notification"
import { instructorCanAccessCourse } from "@/lib/instructor-actor-scope"

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

export async function facultyReplyToDiscussion(params: {
  instructorId: number
  courseId: number
  threadId: number
  replyText: string
}): Promise<{ replyId: number; threadId: number; href: string }> {
  await ensureForumModerationSchema()
  const replyText = String(params.replyText ?? "").trim()
  if (!replyText) throw new Error("Reply text is required.")

  const threadId = Number(params.threadId)
  if (!Number.isFinite(threadId) || threadId <= 0) {
    throw new Error("thread_id is required.")
  }

  const allowed = await instructorCanAccessCourse(params.instructorId, params.courseId)
  if (!allowed) throw new Error("Instructor cannot moderate discussions for this course.")

  if (!(await threadBelongsToCourse(threadId, params.courseId))) {
    throw new Error("Discussion thread not found in this course.")
  }

  const inserted = asSqlRows<{ id: number }>(await sql`
    INSERT INTO forum_replies (thread_id, student_id, instructor_id, reply_text, is_anonymous)
    VALUES (${threadId}, NULL, ${params.instructorId}, ${replyText}, false)
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
    WHERE t.id = ${threadId} AND i.id = ${params.instructorId}
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

  return {
    replyId: Number(inserted[0]?.id ?? 0),
    threadId,
    href: "/module/discussions",
  }
}

export async function facultyModerateDiscussion(params: {
  instructorId: number
  courseId: number
  threadId: number
  isPinned?: boolean
  isResolved?: boolean
}): Promise<{ threadId: number; href: string }> {
  await ensureForumModerationSchema()
  const threadId = Number(params.threadId)
  if (!Number.isFinite(threadId) || threadId <= 0) {
    throw new Error("thread_id is required.")
  }

  const allowed = await instructorCanAccessCourse(params.instructorId, params.courseId)
  if (!allowed) throw new Error("Instructor cannot moderate discussions for this course.")

  if (!(await threadBelongsToCourse(threadId, params.courseId))) {
    throw new Error("Discussion thread not found in this course.")
  }

  if (params.isPinned !== undefined) {
    await sql`
      UPDATE forum_threads
      SET is_pinned = ${params.isPinned}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${threadId}
    `
  }
  if (params.isResolved !== undefined) {
    await sql`
      UPDATE forum_threads
      SET is_resolved = ${params.isResolved}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${threadId}
    `
  }

  return { threadId, href: "/module/discussions" }
}
