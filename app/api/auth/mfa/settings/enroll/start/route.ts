import { type NextRequest, NextResponse } from "next/server"
import type { AuthUserType } from "@/lib/auth-refresh-tokens"
import { createMfaSettingsEnrollmentChallenge, getPendingEnrollmentSecret, loadMfaChallenge } from "@/lib/mfa/challenge"
import { isMfaEnabled } from "@/lib/mfa/store"
import { buildOtpAuthUri, qrDataUrlForOtpAuth } from "@/lib/mfa/totp"

export const dynamic = "force-dynamic"

function parseBody(body: Record<string, unknown>): { userType: AuthUserType; userId: number } | null {
  const userType = body.userType as AuthUserType | undefined
  const userId = Number(body.userId)
  if (!userType || !Number.isFinite(userId)) return null
  if (!["student", "instructor", "admin"].includes(userType)) return null
  return { userType, userId }
}

/** Start optional MFA enrollment from Settings (QR + manual key). */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>
    const parsed = parseBody(body)
    if (!parsed) {
      return NextResponse.json({ error: "userType and userId required." }, { status: 400 })
    }

    if (await isMfaEnabled(parsed.userType, parsed.userId)) {
      return NextResponse.json({ error: "Two-factor is already enabled." }, { status: 400 })
    }

    const accountName = String(body.accountName ?? `user-${parsed.userId}`)
    const issuer = String(body.issuer ?? "CourseCollab")
    const { challengeToken } = await createMfaSettingsEnrollmentChallenge({
      ...parsed,
      accountName,
      issuer,
    })

    const challenge = await loadMfaChallenge(challengeToken)
    if (!challenge) {
      return NextResponse.json({ error: "Could not start enrollment." }, { status: 500 })
    }
    const secret = await getPendingEnrollmentSecret(challenge)
    if (!secret) {
      return NextResponse.json({ error: "Could not prepare authenticator secret." }, { status: 500 })
    }

    const otpauthUri = buildOtpAuthUri({ secret, accountName, issuer })
    const qrDataUrl = await qrDataUrlForOtpAuth(otpauthUri)

    return NextResponse.json({
      enrollmentToken: challengeToken,
      qrDataUrl,
      manualKey: secret,
      accountName,
      issuer,
    })
  } catch (error) {
    console.error("[auth/mfa/settings/enroll/start]", error)
    return NextResponse.json({ error: "Failed to start enrollment." }, { status: 500 })
  }
}
