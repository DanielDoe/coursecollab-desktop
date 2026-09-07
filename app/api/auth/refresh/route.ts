import { type NextRequest, NextResponse } from "next/server"
import {
  readRefreshTokenFromRequest,
  validateRefreshToken,
  rotateRefreshToken,
  setRefreshTokenCookie,
  clearRefreshTokenCookie,
  revokeRefreshToken,
  sessionDurationMs,
  REFRESH_TOKEN_HEADER,
  isDesktopClientRequest,
} from "@/lib/auth-refresh-tokens"
import { buildStudentSessionRefreshPayload } from "@/lib/student-session-refresh-payload"
import { buildInstructorSessionRefreshPayload } from "@/lib/instructor-session-refresh-payload"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const raw = readRefreshTokenFromRequest(request)
  if (!raw) {
    return NextResponse.json({ error: "No refresh token" }, { status: 401 })
  }

  const validated = await validateRefreshToken(raw)
  if (!validated) {
    const response = NextResponse.json({ error: "Invalid or expired session" }, { status: 401 })
    clearRefreshTokenCookie(response)
    return response
  }

  const desktopClient = isDesktopClientRequest(request)
  const effectiveRememberMe = validated.rememberMe || desktopClient

  if (validated.userType !== "student") {
    if (validated.userType !== "instructor") {
      return NextResponse.json({ refreshed: true, userType: validated.userType })
    }

    const instructorPayload = await buildInstructorSessionRefreshPayload({
      instructorId: validated.userId,
      rememberMe: validated.rememberMe,
      universityId: validated.universityId,
    })

    if (!instructorPayload) {
      const response = NextResponse.json({ error: "User not found" }, { status: 401 })
      clearRefreshTokenCookie(response)
      return response
    }

    const { rawToken, expiresAt } = await rotateRefreshToken({
      previousRawToken: raw,
      userType: "instructor",
      userId: validated.userId,
      universityId: validated.universityId,
      rememberMe: effectiveRememberMe,
      desktopClient,
      userAgent: request.headers.get("user-agent"),
      ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    })

    const response = NextResponse.json({
      refreshed: true,
      userType: "instructor",
      rememberMe: effectiveRememberMe,
      sessionExpiresIn: sessionDurationMs(effectiveRememberMe, { desktopClient }),
      instructor: instructorPayload.instructor,
    })
    setRefreshTokenCookie(response, rawToken, expiresAt)
    response.headers.set(REFRESH_TOKEN_HEADER, rawToken)
    return response
  }

  const payload = await buildStudentSessionRefreshPayload({
    studentDbId: validated.userId,
    universityId: validated.universityId,
    rememberMe: validated.rememberMe,
  })

  if (!payload) {
    const response = NextResponse.json({ error: "User not found" }, { status: 401 })
    clearRefreshTokenCookie(response)
    return response
  }

  const { rawToken, expiresAt } = await rotateRefreshToken({
    previousRawToken: raw,
    userType: "student",
    userId: validated.userId,
    universityId: validated.universityId,
    rememberMe: effectiveRememberMe,
    desktopClient,
    userAgent: request.headers.get("user-agent"),
    ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
  })

  const response = NextResponse.json({
    refreshed: true,
    sessionExpiresIn: sessionDurationMs(effectiveRememberMe, { desktopClient }),
    rememberMe: effectiveRememberMe,
    effectiveMembershipTier: payload.effectiveMembershipTier,
    university: payload.university,
    student: payload.student,
    enrollment: payload.enrollment,
    enrollments: payload.enrollments,
  })
  setRefreshTokenCookie(response, rawToken, expiresAt)
  response.headers.set(REFRESH_TOKEN_HEADER, rawToken)
  return response
}

export async function DELETE(request: NextRequest) {
  const raw = readRefreshTokenFromRequest(request)
  if (raw) await revokeRefreshToken(raw)
  const response = NextResponse.json({ ok: true })
  clearRefreshTokenCookie(response)
  return response
}
