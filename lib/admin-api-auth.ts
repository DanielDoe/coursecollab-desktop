import { type NextRequest, NextResponse } from "next/server"
import { readRefreshTokenFromRequest, validateRefreshToken } from "@/lib/auth-refresh-tokens"
import { resolveAdminIdFromMfaTrust } from "@/lib/mfa/trust"

/** Claimed id only — never identity. */
export function getAdminIdFromRequest(request: NextRequest): string | null {
  const fromHeader = request.headers.get("x-admin-id")
  if (fromHeader?.trim()) return fromHeader.trim()
  const url = new URL(request.url)
  const fromQuery = url.searchParams.get("adminId")
  if (fromQuery?.trim()) return fromQuery.trim()
  return null
}

export async function resolveAdminIdFromSessionProof(
  request: NextRequest,
): Promise<number | null> {
  const rawRefresh = readRefreshTokenFromRequest(request)
  if (rawRefresh) {
    const validated = await validateRefreshToken(rawRefresh)
    if (validated?.userType === "admin" && Number.isFinite(validated.userId) && validated.userId > 0) {
      return validated.userId
    }
  }
  return resolveAdminIdFromMfaTrust(request)
}

function unauthorizedAdmin() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
}

function forbiddenAdmin() {
  return NextResponse.json({ error: "Access denied" }, { status: 403 })
}

/**
 * Identity comes from a server-issued session. `x-admin-id` / `adminId` are claims only.
 */
export async function requireAdminId(
  request: NextRequest,
): Promise<{ ok: true; adminId: string } | { ok: false; response: NextResponse }> {
  const adminId = await resolveAdminIdFromSessionProof(request)
  if (adminId == null) {
    void import("@/lib/system-log").then((m) =>
      m.logAuthError(request, {
        action: "admin_api_unauthorized",
        userRole: "admin",
        pageAttempted: new URL(request.url).pathname,
        errorMessage: "Missing or invalid admin session",
        success: false,
      }),
    )
    return { ok: false, response: unauthorizedAdmin() }
  }

  const claimed = getAdminIdFromRequest(request)
  if (claimed) {
    const n = Number(claimed)
    if (!Number.isFinite(n) || n !== adminId) {
      return { ok: false, response: forbiddenAdmin() }
    }
  }

  return { ok: true, adminId: String(adminId) }
}

export const requireAdminSession = requireAdminId
