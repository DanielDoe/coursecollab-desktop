import { type NextRequest, NextResponse } from "next/server"
import { consumeMfaChallenge, loadMfaChallenge, wasMfaChallengeConsumed } from "@/lib/mfa/challenge"
import { completeLoginAfterMfa, normalizeLoginPayload } from "@/lib/mfa/complete-login"
import { consumeRecoveryCode, getDecryptedTotpSecret } from "@/lib/mfa/store"
import { verifyTotpCode } from "@/lib/mfa/totp"

export const dynamic = "force-dynamic"

const MFA_MISCONFIGURED =
  "Two-factor authentication is misconfigured. Contact support or re-enroll on the web app."

/** Verify TOTP or recovery code during login; completes login. */
export async function POST(request: NextRequest) {
  try {
    const { challengeToken, code, recoveryCode } = await request.json()
    if (!challengeToken) {
      return NextResponse.json({ error: "Challenge token required." }, { status: 400 })
    }

    const token = String(challengeToken)
    const challenge = await loadMfaChallenge(token)
    if (!challenge) {
      if (await wasMfaChallengeConsumed(token)) {
        return NextResponse.json(
          { error: "Verification already completed. Sign in again with your password." },
          { status: 409 },
        )
      }
      return NextResponse.json({ error: "Session expired. Sign in again." }, { status: 401 })
    }
    if (challenge.requires_setup) {
      return NextResponse.json({ error: "Complete two-factor setup first." }, { status: 400 })
    }

    const totpCode = String(code ?? "").trim()
    const backup = String(recoveryCode ?? "").trim()
    let verified = false

    if (backup) {
      verified = await consumeRecoveryCode(challenge.user_type, challenge.user_id, backup)
    } else if (totpCode) {
      const secret = await getDecryptedTotpSecret(challenge.user_type, challenge.user_id)
      if (!secret) {
        return NextResponse.json({ error: MFA_MISCONFIGURED }, { status: 503 })
      }
      verified = verifyTotpCode(secret, totpCode)
    } else {
      return NextResponse.json({ error: "Authentication code required." }, { status: 400 })
    }

    if (!verified) {
      return NextResponse.json({ error: "Invalid authentication code." }, { status: 401 })
    }

    const loginPayload = normalizeLoginPayload(challenge.login_payload)
    if (!loginPayload.student && !loginPayload.faculty && !loginPayload.instructor && !loginPayload.admin) {
      console.error("[auth/mfa/verify] login_payload missing user record after normalize")
      return NextResponse.json({ error: "Login failed after verification." }, { status: 500 })
    }

    await consumeMfaChallenge(challenge.id)
    return completeLoginAfterMfa(request, loginPayload)
  } catch (error) {
    console.error("[auth/mfa/verify]", error)
    return NextResponse.json({ error: "Verification failed." }, { status: 500 })
  }
}
