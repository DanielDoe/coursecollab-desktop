import { type NextRequest, NextResponse } from "next/server"
import type { AuthUserType } from "@/lib/auth-refresh-tokens"
import {
  persistRefreshToken,
  REFRESH_TOKEN_HEADER,
  setRefreshTokenCookie,
  isDesktopClientRequest,
} from "@/lib/auth-refresh-tokens"
import { createMfaDeviceTrust, setMfaTrustCookieOnResponse } from "@/lib/mfa/trust"

function clientIp(request: NextRequest): string | null {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    null
  )
}

function resolveTrustTarget(loginPayload: Record<string, unknown>): {
  userType: AuthUserType
  userId: number
} | null {
  const refreshMeta = loginPayload._refreshMeta as
    | { userType: AuthUserType; userId: number }
    | undefined
  if (refreshMeta?.userType && Number.isFinite(refreshMeta.userId)) {
    return { userType: refreshMeta.userType, userId: refreshMeta.userId }
  }
  if (loginPayload.admin) {
    return { userType: "admin", userId: Number((loginPayload.admin as { id: number }).id) }
  }
  if (loginPayload.faculty || loginPayload.instructor) {
    const f = (loginPayload.faculty ?? loginPayload.instructor) as { id: number }
    return { userType: "instructor", userId: Number(f.id) }
  }
  if (loginPayload.student) {
    return { userType: "student", userId: Number((loginPayload.student as { id: number }).id) }
  }
  return null
}

export function normalizeLoginPayload(loginPayload: unknown): Record<string, unknown> {
  if (typeof loginPayload === "string") {
    try {
      const parsed = JSON.parse(loginPayload) as unknown
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>
      }
    } catch {
      /* fall through */
    }
    return {}
  }
  if (loginPayload && typeof loginPayload === "object" && !Array.isArray(loginPayload)) {
    return loginPayload as Record<string, unknown>
  }
  return {}
}

/** Issue session + MFA device trust after password+MFA (or trusted-device skip). */
export async function completeLoginAfterMfa(
  request: NextRequest,
  loginPayload: Record<string, unknown>,
): Promise<NextResponse> {
  const normalized = normalizeLoginPayload(loginPayload)
  const payload: Record<string, unknown> = { ...normalized }
  delete payload.mfaAccountName
  delete payload.mfaIssuer
  delete payload._refreshMeta

  const refreshMeta = normalized._refreshMeta as
    | {
        userType: "student" | "instructor" | "admin"
        userId: number
        universityId?: number | null
        rememberMe?: boolean
      }
    | undefined

  const trustTarget = resolveTrustTarget(normalized)
  let deviceTrust: { rawToken: string; expiresAt: Date } | null = null
  if (trustTarget) {
    try {
      deviceTrust = await createMfaDeviceTrust(trustTarget)
      payload.mfaDeviceTrustToken = deviceTrust.rawToken
      payload.mfaDeviceTrustExpiresAt = deviceTrust.expiresAt.toISOString()
    } catch (err) {
      console.error("[mfa/complete-login] device trust failed (non-blocking):", err)
    }
  }

  const response = NextResponse.json(payload)

  const refreshTarget =
    refreshMeta?.userType && Number.isFinite(refreshMeta.userId)
      ? refreshMeta
      : trustTarget && (trustTarget.userType === "student" || trustTarget.userType === "instructor")
        ? { ...trustTarget, universityId: null as number | null, rememberMe: false }
        : null

  if (
    refreshTarget &&
    (refreshTarget.userType === "student" || refreshTarget.userType === "instructor")
  ) {
    const desktopClient = isDesktopClientRequest(request)
    const { rawToken, expiresAt } = await persistRefreshToken({
      userType: refreshTarget.userType,
      userId: refreshTarget.userId,
      universityId: refreshTarget.universityId ?? null,
      rememberMe: Boolean(refreshTarget.rememberMe) || desktopClient,
      desktopClient,
      userAgent: request.headers.get("user-agent"),
      ipAddress: clientIp(request),
    })
    setRefreshTokenCookie(response, rawToken, expiresAt)
    response.headers.set(REFRESH_TOKEN_HEADER, rawToken)
  }

  if (deviceTrust) {
    setMfaTrustCookieOnResponse(response, deviceTrust.rawToken, deviceTrust.expiresAt)
  }

  return response
}
