import { type NextRequest, NextResponse } from "next/server"
import type { AuthUserType } from "@/lib/auth-refresh-tokens"
import { disableUserMfa, getDecryptedTotpSecret, isMfaEnabled } from "@/lib/mfa/store"
import { verifyTotpCode } from "@/lib/mfa/totp"

export const dynamic = "force-dynamic"

/** Disable MFA from Settings — future logins skip authenticator until re-enabled. */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const userType = body.userType as AuthUserType | undefined
    const userId = Number(body.userId)
    const code = body.code != null ? String(body.code) : ""

    if (!userType || !Number.isFinite(userId)) {
      return NextResponse.json({ error: "userType and userId required." }, { status: 400 })
    }
    if (!["student", "instructor", "admin"].includes(userType)) {
      return NextResponse.json({ error: "Invalid userType." }, { status: 400 })
    }

    if (!(await isMfaEnabled(userType, userId))) {
      return NextResponse.json({ enabled: false, message: "Two-factor is already off." })
    }

    const secret = await getDecryptedTotpSecret(userType, userId)
    if (secret) {
      if (!code) {
        return NextResponse.json(
          { error: "Enter a current authenticator code to turn off two-factor." },
          { status: 400 },
        )
      }
      if (!verifyTotpCode(secret, code)) {
        return NextResponse.json({ error: "Invalid code. Try again." }, { status: 401 })
      }
    }

    await disableUserMfa(userType, userId)
    return NextResponse.json({
      enabled: false,
      message: "Two-factor authentication is off. You can enable it again anytime.",
    })
  } catch (error) {
    console.error("[auth/mfa/settings/disable]", error)
    return NextResponse.json({ error: "Failed to disable two-factor." }, { status: 500 })
  }
}
