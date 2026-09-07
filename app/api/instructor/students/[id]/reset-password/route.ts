import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import bcrypt from "bcryptjs"
import { getStudentRosterDefaultPassword } from "@/lib/student-roster-default-password"
import { notifyStudentStaffPasswordReset } from "@/lib/email/notify-student-staff-password-reset"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const studentId = Number.parseInt(id)
    const instructorId = request.headers.get("x-instructor-id")

    if (!instructorId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (Number.isNaN(studentId)) {
      return NextResponse.json({ error: "Invalid student ID" }, { status: 400 })
    }

    console.log(`[Password Reset] Instructor ${instructorId} resetting password for student ${studentId}`)

    // Get student details
    const students = await sql`
      SELECT
        s.id,
        s.student_id,
        s.full_name,
        s.email,
        COALESCE(c.course_code, c2.course_code) AS course_code
      FROM students s
      LEFT JOIN courses c ON c.id = s.course_id
      LEFT JOIN sessions sess ON sess.id = s.session_id
      LEFT JOIN courses c2 ON c2.id = sess.course_id
      WHERE s.id = ${studentId}
    `

    if (students.length === 0) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 })
    }

    const student = students[0]

    const defaultPassword = getStudentRosterDefaultPassword(student.course_code as string | undefined)
    const hashedPassword = await bcrypt.hash(defaultPassword, 10)
    
    await sql`
      UPDATE students
      SET 
        password_hash = ${hashedPassword},
        has_changed_password = false
      WHERE id = ${studentId}
    `

    console.log(`[Password Reset] Password reset successful for: ${student.full_name} (${student.student_id})`)

    const emailResult = await notifyStudentStaffPasswordReset({
      email: student.email as string | null,
      fullName: student.full_name as string | null,
      temporaryPassword: defaultPassword,
    })
    if (!emailResult.sent) {
      console.warn(
        "[Password Reset] Student email not sent:",
        emailResult.skippedReason || emailResult.error || "unknown",
      )
    }

    return NextResponse.json({
      success: true,
      message: `Password reset to default: ${defaultPassword}`,
      emailSent: emailResult.sent,
      emailNotice: emailResult.sent
        ? undefined
        : "No valid email on file for this student; share the temporary password securely another way.",
      student: {
        id: student.id,
        student_id: student.student_id,
        full_name: student.full_name,
      },
    })
  } catch (error) {
    console.error("[Password Reset] Failed:", error)
    return NextResponse.json({ 
      error: "Failed to reset password",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}





