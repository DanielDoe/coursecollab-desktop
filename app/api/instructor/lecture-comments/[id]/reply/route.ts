import { type NextRequest, NextResponse } from "next/server"
import { getSQL } from "@/lib/db"

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { reply } = await request.json()
    const sql = getSQL()
    const commentId = params.id

    // Validate input
    if (!reply || !reply.trim()) {
      return NextResponse.json({ error: "Reply content is required" }, { status: 400 })
    }

    // Check if comment exists
    const existingComment = await sql`
      SELECT id, lecture_id, student_id FROM lecture_comments WHERE id = ${commentId}
    `

    if (existingComment.length === 0) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 })
    }

    // Update comment with instructor reply
    const result = await sql`
      UPDATE lecture_comments 
      SET 
        instructor_reply = ${reply},
        instructor_reply_date = NOW(),
        is_resolved = true,
        updated_at = NOW()
      WHERE id = ${commentId}
      RETURNING *
    `

    // In a real application, you might want to send a notification to the student
    // For now, we'll just return the updated comment

    return NextResponse.json({
      comment: result[0],
      message: "Reply posted successfully"
    })
  } catch (error) {
    console.error("[v0] Failed to post reply:", error)
    return NextResponse.json({ error: "Failed to post reply" }, { status: 500 })
  }
}
