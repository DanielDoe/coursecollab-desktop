import { type NextRequest, NextResponse } from "next/server"
import type { AuthUserType } from "@/lib/auth-refresh-tokens"
import { createMfaLoginChallenge } from "@/lib/mfa/challenge"
import { completeLoginAfterMfa } from "@/lib/mfa/complete-login"
import { shouldBypassMfa } from "@/lib/mfa/review-bypass"
import { getDecryptedTotpSecret, isMfaEnabled } from "@/lib/mfa/store"
import { hasValidMfaTrust } from "@/lib/mfa/trust"

/** After password verification, require MFA only when the user has already enabled it. */
export async function gateLoginWithMfa(params: {
  userType: AuthUserType
  userId: number
  loginPayload: Record<string, unknown>
  request: NextRequest
}): Promise<NextResponse> {
  if (await shouldBypassMfa(params.userType, params.userId)) {
    return completeLoginAfterMfa(params.request, params.loginPayload)
  }

  const enabled = await isMfaEnabled(params.userType, params.userId)

  // MFA is optional until the user activates it in Settings → Security.
  if (!enabled) {
    return completeLoginAfterMfa(params.request, params.loginPayload)
  }

  if (await hasValidMfaTrust(params.request, params.userType, params.userId)) {
    return completeLoginAfterMfa(params.request, params.loginPayload)
  }

  // Local dev: production-encrypted TOTP secrets cannot be verified without MFA_ENCRYPTION_KEY.
  if (process.env.NODE_ENV !== "production" && process.env.MFA_FORCE_LOCAL !== "true") {
    const secret = await getDecryptedTotpSecret(params.userType, params.userId)
    if (!secret) {
      return completeLoginAfterMfa(params.request, params.loginPayload)
    }
  }

  const { challengeToken, requiresSetup } = await createMfaLoginChallenge(params)
  return NextResponse.json({
    mfaRequired: true,
    requiresSetup,
    challengeToken,
    userType: params.userType,
  })
}

export function isMfaGatedResponse(data: Record<string, unknown>): boolean {
  return Boolean(data.mfaRequired && data.challengeToken)
}
