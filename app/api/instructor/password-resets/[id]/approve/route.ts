import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import bcrypt from "bcryptjs"
import { notifyStudentStaffPasswordReset } from "@/lib/email/notify-student-staff-password-reset"
import { getStudentRosterDefaultPassword } from "@/lib/student-roster-default-password"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"

export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response

    const { id } = await params
    const { adminId, notes } = await request.json()

    const [resetRequest] = await sql`
      SELECT pr.*, s.email, s.full_name, s.student_id
      FROM password_reset_requests pr
      JOIN students s ON pr.student_id = s.id
      JOIN sessions sess ON s.session_id = sess.id
      WHERE pr.id = ${id} AND pr.status = 'pending'
        AND sess.course_id = ${scope.course.id}
    `

    if (!resetRequest) {
      return NextResponse.json({ error: "Request not found or already processed" }, { status: 404 })
    }

    // Reset password to course default (hash it first)
    const defaultPassword = getStudentRosterDefaultPassword(scope.course.course_code)
    const hashedPassword = await bcrypt.hash(defaultPassword, 10)
    
    await sql`
      UPDATE students
      SET 
        password_hash = ${hashedPassword},
        has_changed_password = false
      WHERE id = ${resetRequest.student_id}
    `

    // Update request status to approved
    await sql`
      UPDATE password_reset_requests
      SET 
        status = 'approved',
        reviewed_at = CURRENT_TIMESTAMP,
        reviewed_by = ${scope.instructorId || adminId || 1},
        admin_notes = ${notes || null}
      WHERE id = ${id}
    `

    const emailResult = await notifyStudentStaffPasswordReset({
      email: resetRequest.email as string | null,
      fullName: resetRequest.full_name as string | null,
      temporaryPassword: defaultPassword,
    })
    if (!emailResult.sent) {
      console.warn(
        "[Password Reset Approval] Student email not sent:",
        emailResult.skippedReason || emailResult.error || "unknown",
      )
    }

    return NextResponse.json({
      success: true,
      message: `Password reset approved. Student can now login with default password ${defaultPassword}.`,
      emailSent: emailResult.sent,
      emailNotice: emailResult.sent
        ? undefined
        : "No valid email on file; tell the student the temporary password in person or via your LMS.",
    })
  } catch (error) {
    console.error("[v0] Failed to approve password reset:", error)
    return NextResponse.json({ 
      error: "Failed to approve request",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}


