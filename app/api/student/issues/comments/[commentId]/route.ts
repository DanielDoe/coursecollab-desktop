import { type NextRequest, NextResponse } from "next/server"
import { requireCallerStudentDbId } from "@/lib/student-api-auth"
import { sql } from "@/lib/db"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function PATCH(request: NextRequest, { params }: { params: { commentId: string } }) {
  try {
    const commentId = Number.parseInt(params.commentId)
    const body = await request.json()
    const { commentText } = body

    const auth = await requireCallerStudentDbId(request)
    if (!auth.ok) return auth.response
    const studentIdHeader = String(auth.studentDbId)
    if (!studentIdHeader) {
      return NextResponse.json({ error: "Student ID required" }, { status: 401 })
    }

    if (!commentText) {
      return NextResponse.json({ error: "Comment text is required" }, { status: 400 })
    }

    // Check if comment exists and belongs to the student
    const commentCheck = await sql`
      SELECT id FROM quiz_issue_comments 
      WHERE id = ${commentId} AND commenter_id = ${studentIdHeader}
    `

    if (commentCheck.length === 0) {
      return NextResponse.json({ error: "Comment not found or access denied" }, { status: 404 })
    }

    // Update the comment
    await sql`
      UPDATE quiz_issue_comments
      SET comment_text = ${commentText}, updated_at = NOW()
      WHERE id = ${commentId} AND commenter_id = ${studentIdHeader}
    `

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to update comment:", error)
    return NextResponse.json({ error: "Failed to update comment" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { commentId: string } }) {
  try {
    const commentId = Number.parseInt(params.commentId)

    const auth = await requireCallerStudentDbId(request)
    if (!auth.ok) return auth.response
    const studentIdHeader = String(auth.studentDbId)
    if (!studentIdHeader) {
      return NextResponse.json({ error: "Student ID required" }, { status: 401 })
    }

    // Check if comment exists and belongs to the student
    const commentCheck = await sql`
      SELECT id FROM quiz_issue_comments 
      WHERE id = ${commentId} AND commenter_id = ${studentIdHeader}
    `

    if (commentCheck.length === 0) {
      return NextResponse.json({ error: "Comment not found or access denied" }, { status: 404 })
    }

    // Delete the comment
    await sql`DELETE FROM quiz_issue_comments WHERE id = ${commentId} AND commenter_id = ${studentIdHeader}`

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to delete comment:", error)
    return NextResponse.json({ error: "Failed to delete comment" }, { status: 500 })
  }
}
