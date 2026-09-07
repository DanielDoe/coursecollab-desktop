import { type NextRequest, NextResponse } from "next/server"
import {
  readRefreshTokenFromRequest,
  revokeRefreshToken,
  revokeAllRefreshTokensForUser,
  validateRefreshToken,
  clearRefreshTokenCookie,
} from "@/lib/auth-refresh-tokens"
import { clearMfaTrustCookie, revokeMfaDeviceTrustFromRequest } from "@/lib/mfa/trust"

export const dynamic = "force-dynamic"

type LogoutBody = { explicit?: boolean }

/** End portal session. Explicit sign-out revokes all refresh tokens and MFA device trust. */
export async function POST(request: NextRequest) {
  const raw = readRefreshTokenFromRequest(request)
  let validated: Awaited<ReturnType<typeof validateRefreshToken>> = null

  if (raw) {
    validated = await validateRefreshToken(raw)
  }

  let explicit = false
  try {
    const body = (await request.json()) as LogoutBody
    explicit = body?.explicit === true
  } catch {
    /* no body */
  }

  if (validated) {
    if (explicit) {
      await revokeAllRefreshTokensForUser(validated.userType, validated.userId)
      await revokeMfaDeviceTrustFromRequest(request, validated.userType, validated.userId)
    } else if (raw) {
      await revokeRefreshToken(raw)
    }
  } else if (raw) {
    await revokeRefreshToken(raw)
  }

  const response = NextResponse.json({ ok: true })
  clearRefreshTokenCookie(response)
  clearMfaTrustCookie(response)
  return response
}
