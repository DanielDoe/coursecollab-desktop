import { type NextRequest, NextResponse } from "next/server"
import { countUnusedRecoveryCodes, isMfaEnabled } from "@/lib/mfa/store"
import {
  DEFAULT_MFA_TRUST_DAYS,
  createMfaDeviceTrust,
  getMfaTrustDurationDays,
  hasValidMfaTrust,
  setMfaTrustCookieOnResponse,
  setMfaTrustDurationDays,
} from "@/lib/mfa/trust"
import type { AuthUserType } from "@/lib/auth-refresh-tokens"

export const dynamic = "force-dynamic"

function parseUserParams(request: NextRequest): { userType: AuthUserType; userId: number } | null {
  const userType = request.nextUrl.searchParams.get("userType") as AuthUserType | null
  const userId = Number(request.nextUrl.searchParams.get("userId"))
  if (!userType || !Number.isFinite(userId)) return null
  if (!["student", "instructor", "admin"].includes(userType)) return null
  return { userType, userId }
}

/** MFA status for authenticated settings views. */
export async function GET(request: NextRequest) {
  try {
    const params = parseUserParams(request)
    if (!params) {
      return NextResponse.json({ error: "userType and userId required." }, { status: 400 })
    }

    const { userType, userId } = params
    const enabled = await isMfaEnabled(userType, userId)
    const unusedRecoveryCodes = enabled ? await countUnusedRecoveryCodes(userType, userId) : 0
    const trustDurationDays = enabled
      ? await getMfaTrustDurationDays(userType, userId)
      : DEFAULT_MFA_TRUST_DAYS

    return NextResponse.json({
      enabled,
      required: false,
      unusedRecoveryCodes,
      trustDurationDays,
      defaultTrustDurationDays: DEFAULT_MFA_TRUST_DAYS,
    })
  } catch (error) {
    console.error("[auth/mfa/status]", error)
    return NextResponse.json({ error: "Failed to load MFA status." }, { status: 500 })
  }
}

/** Update MFA trust duration (days before re-prompting on this device). */
export async function PATCH(request: NextRequest) {
  try {
    const params = parseUserParams(request)
    if (!params) {
      return NextResponse.json({ error: "userType and userId required." }, { status: 400 })
    }

    const { userType, userId } = params
    const enabled = await isMfaEnabled(userType, userId)
    if (!enabled) {
      return NextResponse.json({ error: "Enable two-factor authentication first." }, { status: 400 })
    }

    const body = await request.json()
    const trustDurationDays = await setMfaTrustDurationDays(
      userType,
      userId,
      Number(body.trustDurationDays),
    )

    // Re-issue this device's trust for the new duration so the next login skips MFA
    // without waiting for another authenticator challenge.
    const payload: Record<string, unknown> = { trustDurationDays }
    if (await hasValidMfaTrust(request, userType, userId)) {
      try {
        const trust = await createMfaDeviceTrust({ userType, userId, trustDays: trustDurationDays })
        payload.mfaDeviceTrustToken = trust.rawToken
        payload.mfaDeviceTrustExpiresAt = trust.expiresAt.toISOString()
        const response = NextResponse.json(payload)
        setMfaTrustCookieOnResponse(response, trust.rawToken, trust.expiresAt)
        return response
      } catch (err) {
        console.error("[auth/mfa/status PATCH] reissue trust failed (non-blocking):", err)
      }
    }

    return NextResponse.json(payload)
  } catch (error) {
    console.error("[auth/mfa/status PATCH]", error)
    return NextResponse.json({ error: "Failed to update trust duration." }, { status: 500 })
  }
}
