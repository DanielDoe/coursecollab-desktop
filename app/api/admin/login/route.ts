import { type NextRequest, NextResponse } from "next/server"
import { getSQL } from "@/lib/db"
import { ensurePortalRbacSchema } from "@/lib/ensure-portal-rbac-schema"
import {
  ACTIVITY_ACTIONS,
  logPlatformActivityFromRequest,
} from "@/lib/platform-activity-log"
import { gateLoginWithMfa } from "@/lib/mfa/login-gate"
import {
  adminPasswordNeedsRehash,
  hashAdminPassword,
  verifyAdminPassword,
} from "@/lib/admin-password"

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json()

    if (!username || !password) {
      return NextResponse.json({ error: "Username and password are required" }, { status: 400 })
    }

    const trimmedUsername = String(username).trim()
    const sql = getSQL()
    await ensurePortalRbacSchema()

    const adminResult = await sql`
      SELECT id, username, password_hash, COALESCE(role, 'PLATFORM_ADMIN') AS role
      FROM admin_users
      WHERE LOWER(username) = LOWER(${trimmedUsername})
      LIMIT 1
    `

    if (adminResult.length === 0) {
      await logPlatformActivityFromRequest(request, {
        portal: "admin",
        actorType: "admin",
        action: ACTIVITY_ACTIONS.LOGIN_FAILED,
        category: "auth",
        success: false,
        summary: `Failed admin login for username "${trimmedUsername}"`,
        metadata: { username: trimmedUsername },
      })
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
    }

    const admin = adminResult[0]
    const storedHash = String(admin.password_hash ?? "")

    const isValid = await verifyAdminPassword(String(password), storedHash)

    if (!isValid) {
      await logPlatformActivityFromRequest(request, {
        portal: "admin",
        actorType: "admin",
        actorId: admin.id,
        actorLabel: admin.username,
        action: ACTIVITY_ACTIONS.LOGIN_FAILED,
        category: "auth",
        success: false,
        summary: `Failed admin login for ${admin.username}`,
        metadata: { username: trimmedUsername },
      })
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
    }

    if (adminPasswordNeedsRehash(storedHash)) {
      const hashedPassword = await hashAdminPassword(String(password))
      await sql`
        UPDATE admin_users
        SET password_hash = ${hashedPassword}
        WHERE id = ${admin.id}
      `
    }

    await logPlatformActivityFromRequest(request, {
      portal: "admin",
      actorType: "admin",
      actorId: admin.id,
      actorLabel: admin.username,
      action: ACTIVITY_ACTIONS.LOGIN_SUCCESS,
      category: "auth",
      summary: `Admin ${admin.username} passed password check — MFA pending`,
      metadata: { username: trimmedUsername, platformRole: admin.role, mfaPending: true },
    })

    return gateLoginWithMfa({
      userType: "admin",
      userId: Number(admin.id),
      request,
      loginPayload: {
        admin: {
          id: admin.id,
          username: admin.username,
          platformRole: admin.role ?? "PLATFORM_ADMIN",
        },
        mfaAccountName: admin.username,
        mfaIssuer: "CourseCollab Admin",
      },
    })
  } catch (error) {
    console.error("[v0] Admin login error:", error)
    return NextResponse.json({ error: "Failed to login" }, { status: 500 })
  }
}
