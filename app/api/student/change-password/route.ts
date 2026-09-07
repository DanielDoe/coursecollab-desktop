import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { isAppStoreReviewDemoStudentExternalId } from "@/lib/app-store-review-accounts"

import bcrypt from "bcryptjs"
import {
  ACTIVITY_ACTIONS,
  logPlatformActivityFromRequest,
} from "@/lib/platform-activity-log"


export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function POST(request: NextRequest) {
  try {
    const { studentId, currentPassword, newPassword } = await request.json()

    // Validate input
    if (studentId == null || studentId === "" || !currentPassword || !newPassword) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 })
    }

    const numericId =
      typeof studentId === "number" && Number.isFinite(studentId)
        ? Math.trunc(studentId)
        : parseInt(String(studentId), 10)
    if (!Number.isFinite(numericId) || numericId < 1) {
      return NextResponse.json({ error: "Invalid student id" }, { status: 400 })
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

    // Get student
    const students = await sql`
      SELECT * FROM students WHERE id = ${numericId}
    `

    if (students.length === 0) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 })
    }

    const student = students[0] as {
      password_hash: string
      has_changed_password: boolean
      is_platform_guest?: boolean | null
      full_name: string
      email: string | null
      student_id?: string | null
    }

    // Verify current password
    const passwordMatch = await bcrypt.compare(currentPassword, student.password_hash)

    if (!passwordMatch) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 })
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 10)

    // Check if this is the first time changing password (activating trial)
    const isFirstPasswordChange = !student.has_changed_password
    const isGuest = Boolean(student.is_platform_guest)
    const isReviewDemoStudent = isAppStoreReviewDemoStudentExternalId(student.student_id)
    const activateTrial = isFirstPasswordChange && !isGuest && !isReviewDemoStudent

    // Update password and mark as changed
    // If this is the first password change, also activate the 7-day trial (rostered students only)
    if (activateTrial) {
      await sql`
        UPDATE students
        SET 
          password_hash = ${newPasswordHash}, 
          has_changed_password = true,
          trial_start_date = CURRENT_TIMESTAMP
        WHERE id = ${numericId}
      `
    } else {
      await sql`
        UPDATE students
        SET password_hash = ${newPasswordHash}, has_changed_password = true
        WHERE id = ${numericId}
      `
    }

    await logPlatformActivityFromRequest(request, {
      portal: isGuest ? "guest" : "student",
      actorType: "student",
      actorId: numericId,
      actorLabel: student.full_name,
      actorEmail: student.email,
      action: ACTIVITY_ACTIONS.PASSWORD_CHANGED,
      category: "profile",
      summary: `Student ${student.full_name} changed password`,
      metadata: { firstChange: isFirstPasswordChange },
    })

    return NextResponse.json({
      success: true,
      trialActivated: activateTrial,
    })
  } catch (error) {
    console.error("[v0] Change password error:", error)
    return NextResponse.json({ error: "Failed to change password" }, { status: 500 })
  }
}
