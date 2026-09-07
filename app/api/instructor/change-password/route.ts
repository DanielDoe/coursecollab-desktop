import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { ensureInstructorRoleColumns } from "@/lib/ensure-instructor-role-columns"
import { FACULTY_DEFAULT_PASSWORD } from "@/lib/faculty-default-password"
import {
  ensureFacultyPasswordColumn,
  hashFacultyPassword,
  verifyFacultyPassword,
} from "@/lib/faculty-password"
import {
  ACTIVITY_ACTIONS,
  logPlatformActivityFromRequest,
} from "@/lib/platform-activity-log"

export const dynamic = "force-dynamic"

function validatePasswordStrength(password: string): string | null {
  if (password.length < 8) return "Password must be at least 8 characters"
  if (!/\d/.test(password)) return "Password must contain at least 1 number"
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) return "Password must contain at least 1 special character"
  if (password === FACULTY_DEFAULT_PASSWORD) return "Choose a password different from the default faculty password"
  return null
}

export async function POST(request: NextRequest) {
  try {
    const { instructorId, currentPassword, newPassword } = await request.json()

    const id = Number(instructorId)
    const headerId = Number(request.headers.get("x-instructor-id") ?? "")
    if (!Number.isFinite(id) || id < 1) {
      return NextResponse.json({ error: "Invalid instructor id" }, { status: 400 })
    }
    if (Number.isFinite(headerId) && headerId > 0 && headerId !== id) {
      return NextResponse.json({ error: "You can only change your own password." }, { status: 403 })
    }
    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: "Current and new password are required" }, { status: 400 })
    }

    const strengthError = validatePasswordStrength(String(newPassword))
    if (strengthError) {
      return NextResponse.json({ error: strengthError }, { status: 400 })
    }

    await ensureInstructorRoleColumns()
    await ensureFacultyPasswordColumn()

    const rows = await sql`
      SELECT id, password, COALESCE(has_changed_password, true) AS has_changed_password, name, email
      FROM instructors
      WHERE id = ${id}
      LIMIT 1
    `
    if (rows.length === 0) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 })
    }

    const row = rows[0] as { password: string; has_changed_password: boolean; name: string; email: string }
    if (!(await verifyFacultyPassword(String(currentPassword), row.password))) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 })
    }

    const nextHash = await hashFacultyPassword(String(newPassword))
    await sql`
      UPDATE instructors
      SET password = ${nextHash}, has_changed_password = true
      WHERE id = ${id}
    `

    await logPlatformActivityFromRequest(request, {
      portal: "faculty",
      actorType: "instructor",
      actorId: id,
      actorLabel: row.name,
      actorEmail: row.email,
      action: ACTIVITY_ACTIONS.PASSWORD_CHANGED,
      category: "profile",
      summary: `Faculty ${row.name} changed password`,
    })

    return NextResponse.json({ success: true, hasChangedPassword: true })
  } catch (error) {
    console.error("[instructor/change-password]", error)
    return NextResponse.json({ error: "Failed to change password" }, { status: 500 })
  }
}
