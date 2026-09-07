import { type NextRequest, NextResponse } from "next/server"
import {
  consumeMfaChallenge,
  getPendingEnrollmentSecret,
  loadMfaChallenge,
} from "@/lib/mfa/challenge"
import { completeLoginAfterMfa, normalizeLoginPayload } from "@/lib/mfa/complete-login"
import {
  enableUserMfa,
  generateRecoveryCodeSet,
  storeRecoveryCodes,
} from "@/lib/mfa/store"
import { verifyTotpCode } from "@/lib/mfa/totp"
import { DEFAULT_MFA_TRUST_DAYS } from "@/lib/mfa/trust"

export const dynamic = "force-dynamic"

/** Confirm MFA enrollment with first TOTP code; completes login. */
export async function POST(request: NextRequest) {
  try {
    const { challengeToken, code } = await request.json()
    if (!challengeToken || !code) {
      return NextResponse.json({ error: "Challenge token and code required." }, { status: 400 })
    }

    const challenge = await loadMfaChallenge(String(challengeToken))
    if (!challenge) {
      return NextResponse.json({ error: "Session expired. Sign in again." }, { status: 401 })
    }
    if (!challenge.requires_setup) {
      return NextResponse.json({ error: "Already enrolled. Use verify instead." }, { status: 400 })
    }

    const secret = await getPendingEnrollmentSecret(challenge)
    if (!secret) {
      return NextResponse.json(
        { error: "Two-factor setup is misconfigured. Try signing in again on the web app." },
        { status: 503 },
      )
    }
    if (!verifyTotpCode(secret, String(code))) {
      return NextResponse.json({ error: "Invalid code. Check your authenticator app and try again." }, { status: 401 })
    }

    const userMfaId = await enableUserMfa({
      userType: challenge.user_type,
      userId: challenge.user_id,
      secret,
    })
    const recoveryCodes = generateRecoveryCodeSet()
    await storeRecoveryCodes(userMfaId, recoveryCodes)
    await consumeMfaChallenge(challenge.id)

    const loginPayload = {
      ...normalizeLoginPayload(challenge.login_payload),
      mfaEnrolled: true,
      recoveryCodes,
      mfaTrustDays: DEFAULT_MFA_TRUST_DAYS,
    }

    return completeLoginAfterMfa(request, loginPayload)
  } catch (error) {
    console.error("[auth/mfa/enroll/confirm]", error)
    return NextResponse.json({ error: "Enrollment failed." }, { status: 500 })
  }
}
