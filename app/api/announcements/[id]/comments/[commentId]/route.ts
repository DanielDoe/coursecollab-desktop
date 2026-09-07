import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireCallerStudentDbId } from "@/lib/student-api-auth"
import { requireInstructorSession } from "@/lib/instructor-session-auth"

/**
 * DELETE /api/announcements/[id]/comments/[commentId]
 * Delete a comment (student can only delete their own comments)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string, commentId: string }> }
) {
  try {
    const { id, commentId } = await params
    const student = await requireCallerStudentDbId(request)
    const instructor = student.ok ? null : await requireInstructorSession(request)
    if (!student.ok && (!instructor || !instructor.ok)) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }
    const studentId = student.ok ? student.studentDbId : null
    const instructorId = instructor && instructor.ok ? instructor.instructorId : null

    // Check if comment exists and get its author
    const existing = await sql`
      SELECT student_id, announcement_id FROM announcement_comments WHERE id = ${commentId}
    `

    if (existing.length === 0) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 })
    }

    // Students can only delete their own comments
    // Instructors can delete any comment on their announcements
    if (studentId) {
      if (existing[0].student_id !== Number(studentId)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
      }
    } else if (instructorId) {
      // Verify the instructor owns the announcement
      const announcement = await sql`
        SELECT author_id FROM announcements WHERE id = ${id}
      `
      
      if (announcement.length === 0 || announcement[0].author_id !== Number(instructorId)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
      }
    }

    // Delete the comment
    await sql`
      DELETE FROM announcement_comments WHERE id = ${commentId}
    `

    return NextResponse.json({ message: "Comment deleted successfully" })
  } catch (error) {
    console.error("[Comments] DELETE error:", error)
    return NextResponse.json({ error: "Failed to delete comment" }, { status: 500 })
  }
}

