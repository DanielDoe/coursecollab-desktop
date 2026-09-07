import { type NextRequest, NextResponse } from "next/server"
import { getSQL } from "@/lib/db"
import bcrypt from "bcryptjs"

export async function POST(request: NextRequest) {
  try {
    const { requestId, studentDatabaseId, newPassword } = await request.json()

    if (!requestId || !studentDatabaseId || !newPassword) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Validate password strength
    if (newPassword.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 })
    }

    if (!/\d/.test(newPassword)) {
      return NextResponse.json({ error: "Password must contain at least 1 number" }, { status: 400 })
    }

    if (!/[!@#$%^&*(),.?":{}|<>]/.test(newPassword)) {
      return NextResponse.json({ error: "Password must contain at least 1 special character" }, { status: 400 })
    }

    const sql = getSQL()

    // Verify the request is approved and belongs to this student
    const requests = await sql`
      SELECT id FROM password_reset_requests
      WHERE id = ${requestId} 
        AND student_id = ${studentDatabaseId}
        AND status = 'approved'
    `

    if (requests.length === 0) {
      return NextResponse.json({ error: "Invalid or expired reset request" }, { status: 400 })
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 10)

    // Check if this is the first time changing password (activating trial)
    const student = await sql`
      SELECT has_changed_password FROM students WHERE id = ${studentDatabaseId}
    `
    const isFirstPasswordChange = !student[0]?.has_changed_password

    // Update student password
    // If this is the first password change, also activate the 7-day trial
    if (isFirstPasswordChange) {
      await sql`
        UPDATE students
        SET 
          password_hash = ${passwordHash}, 
          has_changed_password = true,
          trial_start_date = CURRENT_TIMESTAMP
        WHERE id = ${studentDatabaseId}
      `
    } else {
      await sql`
        UPDATE students
        SET password_hash = ${passwordHash}, has_changed_password = true
        WHERE id = ${studentDatabaseId}
      `
    }

    // Mark request as completed
    await sql`
      UPDATE password_reset_requests
      SET status = 'completed', completed_at = CURRENT_TIMESTAMP
      WHERE id = ${requestId}
    `

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Failed to complete password reset:", error)
    return NextResponse.json({ error: "Failed to reset password" }, { status: 500 })
  }
}
