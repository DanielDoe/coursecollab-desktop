import { type NextRequest, NextResponse } from "next/server"
import { getSQL } from "@/lib/db"
import { notifyAllAdmins } from "@/lib/create-admin-notification"
import { findStudentsByLoginIdentifier } from "@/lib/student-login-lookup"
import { passwordResetAcceptedResponse } from "@/lib/compliance/password-reset-public"
import { checkRateLimit, PASSWORD_RESET_RATE_LIMIT, rateLimitKey } from "@/lib/compliance/rate-limit"

export async function POST(request: NextRequest) {
  try {
    const limited = checkRateLimit(
      rateLimitKey(request, "student-password-reset"),
      PASSWORD_RESET_RATE_LIMIT.limit,
      PASSWORD_RESET_RATE_LIMIT.windowMs,
    )
    if (!limited.ok) {
      return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 })
    }

    const { studentId, fullName, email } = await request.json()

    if (!studentId || !fullName || !email) {
      return NextResponse.json({ error: "Student ID, full name, and email are required" }, { status: 400 })
    }

    const sql = getSQL()

    const idInput = String(studentId).trim()
    const matches = (await findStudentsByLoginIdentifier(sql, idInput)) as {
      id: number
      full_name: string
      student_id: string
    }[]

    if (matches.length !== 1) {
      return NextResponse.json(passwordResetAcceptedResponse())
    }

    const student = matches[0]

    if (student.full_name.toLowerCase() !== String(fullName).toLowerCase()) {
      return NextResponse.json(passwordResetAcceptedResponse())
    }

    // Check if there's already a pending request
    const existingRequests = await sql`
      SELECT id FROM password_reset_requests 
      WHERE student_id = ${student.id} AND status = 'pending'
    `

    if (existingRequests.length > 0) {
      return NextResponse.json(passwordResetAcceptedResponse())
    }

    // Create password reset request with email
    const requestResult = await sql`
      INSERT INTO password_reset_requests (student_id, status, email)
      VALUES (${student.id}, 'pending', ${email})
      RETURNING id
    `

    const requestId = requestResult[0].id

    // Notify all admins about the new password reset request
    try {
      await notifyAllAdmins({
        type: "password_reset_request",
        title: "New Password Reset Request",
        message: `${student.full_name} (${student.student_id}) has requested a password reset. Please review and approve/reject the request.`,
        link: `/admin/students?tab=password-resets`
      })
    } catch (notificationError) {
      console.error("[v0] Failed to send notification:", notificationError)
      // Don't fail the request if notification fails
    }

    return NextResponse.json(passwordResetAcceptedResponse())
  } catch (error) {
    console.error("[v0] Password reset request error:", error)
    return NextResponse.json({ error: "Failed to submit request" }, { status: 500 })
  }
}
