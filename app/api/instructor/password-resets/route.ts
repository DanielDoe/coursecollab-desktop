import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"

export const dynamic = "force-dynamic"
// Mark as dynamic to prevent build-time database initialization

export async function GET(request: NextRequest) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response

    const requests = await sql`
      SELECT 
        pr.id,
        pr.student_id,
        pr.status,
        pr.requested_at,
        pr.reviewed_at,
        pr.admin_notes,
        s.student_id as student_number,
        s.full_name,
        s.section,
        s.email,
        COALESCE(s.is_platform_guest, false) as is_platform_guest
      FROM password_reset_requests pr
      JOIN students s ON pr.student_id = s.id
      JOIN sessions sess ON s.session_id = sess.id
      WHERE sess.course_id = ${scope.course.id}
      ORDER BY 
        CASE pr.status 
          WHEN 'pending' THEN 1 
          WHEN 'approved' THEN 2 
          WHEN 'rejected' THEN 3 
          WHEN 'completed' THEN 4 
        END,
        pr.requested_at DESC
    `

    return NextResponse.json({ requests })
  } catch (error) {
    console.error("[v0] Failed to fetch password reset requests:", error)
    return NextResponse.json({ error: "Failed to fetch requests" }, { status: 500 })
  }
}
