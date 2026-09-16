import { type NextRequest, NextResponse } from "next/server"
import { requireCallerStudentDbId } from "@/lib/student-api-auth"
import { sql } from "@/lib/db"

import { createNotification } from "@/lib/create-notification"


export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function POST(request: NextRequest) {
  try {
    const { threadId, replyText, isAnonymous, parentReplyId } = await request.json()
    const auth = await requireCallerStudentDbId(request)
    if (!auth.ok) return auth.response
    const studentResult = await sql`
      SELECT id, full_name FROM students WHERE id = ${auth.studentDbId}
    `

    if (studentResult.length === 0) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 })
    }

    const internalStudentId = studentResult[0].id
    const studentName = studentResult[0].full_name

    // Get thread details and author
    const threadResult = await sql`
      SELECT title, student_id FROM forum_threads WHERE id = ${threadId}
    `

    if (threadResult.length === 0) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 })
    }

    const thread = threadResult[0]

    // Create reply
    const replyResult = await sql`
      INSERT INTO forum_replies (thread_id, student_id, reply_text, is_anonymous, parent_reply_id)
      VALUES (${threadId}, ${internalStudentId}, ${replyText}, ${isAnonymous}, ${parentReplyId || null})
      RETURNING id
    `

    // Update thread reply count
    await sql`
      UPDATE forum_threads
      SET reply_count = reply_count + 1, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${threadId}
    `

    // Notify thread author if they're not the one replying
    if (thread.student_id !== internalStudentId) {
      const authorName = isAnonymous ? "Someone" : studentName
      await createNotification({
        studentId: thread.student_id,
        type: "forum",
        title: "New Reply on Your Thread 💬",
        message: `${authorName} replied to "${thread.title}"`,
        link: `/student/forum?thread=${threadId}`,
      })
    }

    // Notify parent-reply author on nested replies
    if (parentReplyId) {
      const parentRows = await sql`
        SELECT student_id FROM forum_replies WHERE id = ${parentReplyId} LIMIT 1
      `
      const parentAuthorId = Number((parentRows[0] as { student_id?: number } | undefined)?.student_id)
      if (
        Number.isFinite(parentAuthorId) &&
        parentAuthorId > 0 &&
        parentAuthorId !== internalStudentId &&
        parentAuthorId !== Number(thread.student_id)
      ) {
        const authorName = isAnonymous ? "Someone" : studentName
        await createNotification({
          studentId: parentAuthorId,
          type: "forum",
          title: "Reply to your comment",
          message: `${authorName} responded to your reply on "${thread.title}"`,
          link: `/student/forum?thread=${threadId}`,
        })
      }
    }

    return NextResponse.json({ success: true, replyId: replyResult[0].id })
  } catch (error) {
    console.error("[v0] Failed to create reply:", error)
    return NextResponse.json({ error: "Failed to create reply" }, { status: 500 })
  }
}
