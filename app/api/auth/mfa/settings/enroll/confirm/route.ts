import { type NextRequest, NextResponse } from "next/server"
import type { AuthUserType } from "@/lib/auth-refresh-tokens"
import {
  consumeMfaChallenge,
  getPendingEnrollmentSecret,
  loadMfaChallenge,
} from "@/lib/mfa/challenge"
import {
  enableUserMfa,
  generateRecoveryCodeSet,
  isMfaEnabled,
  storeRecoveryCodes,
} from "@/lib/mfa/store"
import { verifyTotpCode } from "@/lib/mfa/totp"
import { DEFAULT_MFA_TRUST_DAYS } from "@/lib/mfa/trust"

export const dynamic = "force-dynamic"

/** Confirm Settings enrollment — enables MFA gate on future logins. */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const enrollmentToken = String(body.enrollmentToken ?? "")
    const code = String(body.code ?? "")
    const userType = body.userType as AuthUserType | undefined
    const userId = Number(body.userId)

    if (!enrollmentToken || !code || !userType || !Number.isFinite(userId)) {
      return NextResponse.json(
        { error: "enrollmentToken, code, userType, and userId required." },
        { status: 400 },
      )
    }

    if (await isMfaEnabled(userType, userId)) {
      return NextResponse.json({ error: "Two-factor is already enabled." }, { status: 400 })
    }

    const challenge = await loadMfaChallenge(enrollmentToken)
    if (!challenge || challenge.user_type !== userType || challenge.user_id !== userId) {
      return NextResponse.json({ error: "Enrollment expired. Start setup again." }, { status: 401 })
    }
    if (!challenge.requires_setup) {
      return NextResponse.json({ error: "Invalid enrollment session." }, { status: 400 })
    }

    const secret = await getPendingEnrollmentSecret(challenge)
    if (!secret) {
      return NextResponse.json({ error: "Enrollment secret missing. Start setup again." }, { status: 503 })
    }
    if (!verifyTotpCode(secret, code)) {
      return NextResponse.json({ error: "Invalid code. Check your authenticator and try again." }, { status: 401 })
    }

    const userMfaId = await enableUserMfa({ userType, userId, secret })
    const recoveryCodes = generateRecoveryCodeSet()
    await storeRecoveryCodes(userMfaId, recoveryCodes)
    await consumeMfaChallenge(challenge.id)

    return NextResponse.json({
      enabled: true,
      recoveryCodes,
      trustDurationDays: DEFAULT_MFA_TRUST_DAYS,
      message: "Two-factor authentication is on. You will need your authenticator on future sign-ins.",
    })
  } catch (error) {
    console.error("[auth/mfa/settings/enroll/confirm]", error)
    return NextResponse.json({ error: "Enrollment failed." }, { status: 500 })
  }
}
