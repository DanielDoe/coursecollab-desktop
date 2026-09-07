import { type NextRequest, NextResponse } from "next/server"
import { requireCallerStudentDbId } from "@/lib/student-api-auth"
import {
  publicStudentEnrollments,
  resolveSwitchableStudentEnrollment,
} from "@/lib/student-active-enrollment"
import { buildStudentSessionRefreshPayload } from "@/lib/student-session-refresh-payload"
import {
  persistRefreshToken,
  readRefreshTokenFromRequest,
  rotateRefreshToken,
  sessionDurationMs,
  setRefreshTokenCookie,
  validateRefreshToken,
  REFRESH_TOKEN_HEADER,
} from "@/lib/auth-refresh-tokens"

export const dynamic = "force-dynamic"

/**
 * Bind the authenticated student to another enrolled course.
 * The refresh token is re-issued for the target `students.id` so later
 * course-scoped APIs resolve from that enrollment — never from a client courseId.
 */
export async function POST(request: NextRequest) {
  const auth = await requireCallerStudentDbId(request)
  if (!auth.ok) return auth.response

  let body: { courseId?: unknown; section?: unknown; studentRowId?: unknown } = {}
  try {
    body = (await request.json()) as typeof body
  } catch {
    body = {}
  }

  const resolved = await resolveSwitchableStudentEnrollment(auth.studentDbId, {
    courseId: body.courseId != null ? Number(body.courseId) : null,
    section: typeof body.section === "string" ? body.section : null,
    studentRowId: body.studentRowId != null ? Number(body.studentRowId) : null,
  })
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status })
  }

  const rawRefresh = readRefreshTokenFromRequest(request)
  const validated = rawRefresh ? await validateRefreshToken(rawRefresh) : null
  const rememberMe = validated?.rememberMe ?? true
  const universityId = validated?.universityId ?? null

  const payload = await buildStudentSessionRefreshPayload({
    studentDbId: resolved.enrollment.studentRowId,
    universityId,
    rememberMe,
  })
  if (!payload) {
    return NextResponse.json({ error: "Could not open that enrollment." }, { status: 404 })
  }

  const tokenParams = {
    userType: "student" as const,
    userId: resolved.enrollment.studentRowId,
    universityId,
    rememberMe,
    userAgent: request.headers.get("user-agent"),
    ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
  }
  const responseToken =
    rawRefresh && validated?.userType === "student"
      ? await rotateRefreshToken({ previousRawToken: rawRefresh, ...tokenParams })
      : await persistRefreshToken(tokenParams)

  const response = NextResponse.json({
    student: payload.student,
    enrollment: payload.enrollment,
    enrollments: payload.enrollments,
    university: payload.university,
    effectiveMembershipTier: payload.effectiveMembershipTier,
    rememberMe: payload.rememberMe,
    sessionExpiresIn: sessionDurationMs(rememberMe),
    activeEnrollment: publicStudentEnrollments([resolved.enrollment])[0],
  })
  if (responseToken) {
    setRefreshTokenCookie(response, responseToken.rawToken, responseToken.expiresAt)
    response.headers.set(REFRESH_TOKEN_HEADER, responseToken.rawToken)
  }
  return response
}
