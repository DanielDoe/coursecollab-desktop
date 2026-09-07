import { type NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { sql } from "@/lib/db"
import {
  ACTIVITY_ACTIONS,
  logPlatformActivityFromRequest,
} from "@/lib/platform-activity-log"
import {
  hashAdminPassword,
  verifyAdminPassword,
} from "@/lib/admin-password"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const { adminId, currentPassword, newPassword } = await request.json()

    if (!adminId || !currentPassword || !newPassword) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 })
    }

    if (newPassword.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 })
    }

    if (!/\d/.test(newPassword)) {
      return NextResponse.json({ error: "Password must contain at least 1 number" }, { status: 400 })
    }

    if (!/[!@#$%^&*(),.?":{}|<>]/.test(newPassword)) {
      return NextResponse.json({ error: "Password must contain at least 1 special character" }, { status: 400 })
    }

    const adminResult = await sql`
      SELECT id, username, password_hash
      FROM admin_users
      WHERE id = ${adminId}
    `

    if (adminResult.length === 0) {
      return NextResponse.json({ error: "Admin not found" }, { status: 404 })
    }

    const admin = adminResult[0]

    const isPasswordValid = await verifyAdminPassword(currentPassword, String(admin.password_hash ?? ""))

    if (!isPasswordValid) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 })
    }

    const hashedPassword = await hashAdminPassword(newPassword)

    await sql`
      UPDATE admin_users
      SET password_hash = ${hashedPassword}
      WHERE id = ${adminId}
    `

    await logPlatformActivityFromRequest(request, {
      portal: "admin",
      actorType: "admin",
      actorId: Number(adminId),
      actorLabel: admin.username,
      action: ACTIVITY_ACTIONS.PASSWORD_CHANGED,
      category: "profile",
      summary: `Admin ${admin.username} changed password`,
    })

    return NextResponse.json({
      success: true,
      message: "Password changed successfully",
    })
  } catch (error) {
    console.error("[v0] Error changing admin password:", error)
    return NextResponse.json({ error: "Failed to change password" }, { status: 500 })
  }
}
