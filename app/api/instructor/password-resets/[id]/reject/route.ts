import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"

export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response

    const { id } = await params
    const { adminId, notes } = await request.json()

    const result = await sql`
      UPDATE password_reset_requests pr
      SET 
        status = 'rejected',
        reviewed_at = CURRENT_TIMESTAMP,
        reviewed_by = ${scope.instructorId ?? adminId ?? 1},
        admin_notes = ${notes || null}
      FROM students s
      INNER JOIN sessions sess ON sess.id = s.session_id
      WHERE pr.id = ${id}
        AND pr.student_id = s.id
        AND pr.status = 'pending'
        AND sess.course_id = ${scope.course.id}
      RETURNING pr.student_id
    `

    if (result.length === 0) {
      return NextResponse.json({ error: "Request not found or already processed" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Failed to reject password reset:", error)
    return NextResponse.json({ error: "Failed to reject request" }, { status: 500 })
  }
}

