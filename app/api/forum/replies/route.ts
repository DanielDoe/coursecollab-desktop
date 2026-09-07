import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const threadId = searchParams.get("threadId")

    if (!threadId) {
      return NextResponse.json({ error: "Thread ID required" }, { status: 400 })
    }

    const replies = await sql`
      SELECT 
        r.*,
        s.full_name as author_name,
        COALESCE(sr.points, 0) as author_reputation,
        COALESCE(sr.badges, ARRAY[]::text[]) as author_badges
      FROM forum_replies r
      LEFT JOIN students s ON r.student_id = s.id
      LEFT JOIN student_reputation sr ON r.student_id = sr.student_id
      WHERE r.thread_id = ${threadId}
      ORDER BY r.created_at ASC
    `

    return NextResponse.json({ replies })
  } catch (error) {
    console.error("Failed to fetch replies:", error)
    return NextResponse.json({ error: "Failed to fetch replies" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { threadId, studentId, replyText, parentReplyId, isAnonymous } = body

    if (!threadId || !studentId || !replyText) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const result = await sql`
      INSERT INTO forum_replies (thread_id, student_id, parent_reply_id, reply_text, is_anonymous)
      VALUES (${threadId}, ${studentId}, ${parentReplyId || null}, ${replyText}, ${isAnonymous || false})
      RETURNING *
    `

    // Update reply count on thread
    await sql`
      UPDATE forum_threads 
      SET reply_count = reply_count + 1, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${threadId}
    `

    // Award reputation points for replying
    await sql`
      INSERT INTO student_reputation (student_id, points)
      VALUES (${studentId}, 3)
      ON CONFLICT (student_id) 
      DO UPDATE SET points = student_reputation.points + 3, updated_at = CURRENT_TIMESTAMP
    `

    return NextResponse.json({ reply: result[0] })
  } catch (error) {
    console.error("Failed to create reply:", error)
    return NextResponse.json({ error: "Failed to create reply" }, { status: 500 })
  }
}
