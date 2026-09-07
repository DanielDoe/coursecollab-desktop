import { type NextRequest, NextResponse } from "next/server"
import { readRefreshTokenFromRequest, validateRefreshToken } from "@/lib/auth-refresh-tokens"
import { resolveInstructorIdFromMfaTrust } from "@/lib/mfa/trust"

/** Identity comes from a server-issued session. `x-instructor-id` is never enough. */
export async function resolveInstructorIdFromSessionProof(
  request: NextRequest,
): Promise<number | null> {
  const rawRefresh = readRefreshTokenFromRequest(request)
  if (rawRefresh) {
    const validated = await validateRefreshToken(rawRefresh)
    if (validated?.userType === "instructor" && Number.isFinite(validated.userId) && validated.userId > 0) {
      return validated.userId
    }
  }
  return resolveInstructorIdFromMfaTrust(request)
}

export function unauthorizedInstructorResponse(message = "Instructor authentication required") {
  return NextResponse.json({ error: message }, { status: 401 })
}

export function forbiddenInstructorResponse(message = "Access denied") {
  return NextResponse.json({ error: message }, { status: 403 })
}

export async function requireInstructorSession(
  request: NextRequest,
): Promise<{ ok: true; instructorId: number } | { ok: false; response: NextResponse }> {
  const instructorId = await resolveInstructorIdFromSessionProof(request)
  if (instructorId == null) {
    return { ok: false, response: unauthorizedInstructorResponse() }
  }

  const header = request.headers.get("x-instructor-id")?.trim()
  if (header) {
    const claimed = Number(header)
    if (!Number.isFinite(claimed) || claimed !== instructorId) {
      return { ok: false, response: forbiddenInstructorResponse() }
    }
  }

  return { ok: true, instructorId }
}
