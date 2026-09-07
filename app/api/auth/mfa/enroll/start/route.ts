import { type NextRequest, NextResponse } from "next/server"
import { getPendingEnrollmentSecret, loadMfaChallenge } from "@/lib/mfa/challenge"
import { buildOtpAuthUri, qrDataUrlForOtpAuth } from "@/lib/mfa/totp"

export const dynamic = "force-dynamic"

/** Start MFA enrollment during login (returns QR for authenticator app). */
export async function POST(request: NextRequest) {
  try {
    const { challengeToken } = await request.json()
    if (!challengeToken) {
      return NextResponse.json({ error: "Challenge token required." }, { status: 400 })
    }

    const challenge = await loadMfaChallenge(String(challengeToken))
    if (!challenge) {
      return NextResponse.json({ error: "Session expired. Sign in again." }, { status: 401 })
    }
    if (!challenge.requires_setup) {
      return NextResponse.json({ error: "Two-factor is already set up. Enter your code." }, { status: 400 })
    }

    const secret = await getPendingEnrollmentSecret(challenge)
    if (!secret) {
      return NextResponse.json({ error: "Could not start enrollment." }, { status: 500 })
    }

    const payload = challenge.login_payload
    const accountName =
      String(payload.mfaAccountName ?? payload.accountName ?? payload.email ?? payload.username ?? `user-${challenge.user_id}`)
    const issuer = String(payload.mfaIssuer ?? "CourseCollab")
    const otpauthUri = buildOtpAuthUri({ secret, accountName, issuer })
    const qrDataUrl = await qrDataUrlForOtpAuth(otpauthUri)

    return NextResponse.json({
      qrDataUrl,
      manualKey: secret,
      accountName,
      issuer,
    })
  } catch (error) {
    console.error("[auth/mfa/enroll/start]", error)
    return NextResponse.json({ error: "Failed to start enrollment." }, { status: 500 })
  }
}
