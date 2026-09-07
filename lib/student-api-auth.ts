import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { resolveStudentDatabaseIdFromParam } from "@/lib/resolve-student-db-id"
import { readRefreshTokenFromRequest, validateRefreshToken } from "@/lib/auth-refresh-tokens"
import { resolveInstructorIdFromSessionProof } from "@/lib/instructor-session-auth"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import { studentInSelectedCourseSqlForCourse } from "@/lib/instructor-results-course-scope"
import { readInstructorSessionScopeFromRequest } from "@/lib/instructor-session-scope"
import { resolveStudentIdFromMfaTrust } from "@/lib/mfa/trust"

/**
 * Identity comes from a server-issued session (refresh cookie/header or MFA
 * device trust). `x-student-id` is never enough on its own.
 */
export async function resolveStudentIdFromSessionProof(request: NextRequest): Promise<number | null> {
  const rawRefresh = readRefreshTokenFromRequest(request)
  if (rawRefresh) {
    const validated = await validateRefreshToken(rawRefresh)
    if (validated?.userType === "student" && Number.isFinite(validated.userId) && validated.userId > 0) {
      return validated.userId
    }
  }
  return resolveStudentIdFromMfaTrust(request)
}

export async function resolveCallerStudentDbId(request: NextRequest): Promise<number | null> {
  return resolveStudentIdFromSessionProof(request)
}

export function unauthorizedStudentResponse(message = "Student authentication required") {
  return NextResponse.json({ error: message }, { status: 401 })
}

export function forbiddenStudentResponse(message = "Access denied") {
  return NextResponse.json({ error: message }, { status: 403 })
}

async function claimedIdMatchesSession(
  sessionId: number,
  claimedStudentId: string,
): Promise<boolean> {
  const requestedId = await resolveStudentDatabaseIdFromParam(claimedStudentId.trim())
  return requestedId != null && requestedId === sessionId
}

export async function requireCallerStudentDbId(
  request: NextRequest
): Promise<{ ok: true; studentDbId: number } | { ok: false; response: NextResponse }> {
  const studentDbId = await resolveStudentIdFromSessionProof(request)
  if (studentDbId == null) {
    return { ok: false, response: unauthorizedStudentResponse() }
  }

  const header = request.headers.get("x-student-id")
  if (header?.trim()) {
    const matches = await claimedIdMatchesSession(studentDbId, header)
    if (!matches) {
      return { ok: false, response: forbiddenStudentResponse() }
    }
  }

  return { ok: true, studentDbId }
}

/** Ensures query/body studentId matches the authenticated caller (session). */
export async function requireStudentIdParamMatchesCaller(
  request: NextRequest,
  paramStudentId: string | null | undefined
): Promise<{ ok: true; studentDbId: number } | { ok: false; response: NextResponse }> {
  const caller = await requireCallerStudentDbId(request)
  if (!caller.ok) return caller

  if (!paramStudentId?.trim()) {
    return { ok: true, studentDbId: caller.studentDbId }
  }

  const matches = await claimedIdMatchesSession(caller.studentDbId, paramStudentId)
  if (!matches) {
    return { ok: false, response: forbiddenStudentResponse() }
  }
  return { ok: true, studentDbId: caller.studentDbId }
}

/** Student self, or faculty with a session (optionally scoped to the selected course). */
export async function requireStudentRecordAccess(
  request: NextRequest,
  paramStudentId: string | null | undefined,
): Promise<{ ok: true; studentDbId: number } | { ok: false; response: NextResponse }> {
  const instructorId = await resolveInstructorIdFromSessionProof(request)
  if (instructorId != null) {
    if (!paramStudentId?.trim()) {
      return { ok: false, response: NextResponse.json({ error: "Student ID is required" }, { status: 400 }) }
    }
    const studentDbId = await resolveStudentDatabaseIdFromParam(paramStudentId.trim())
    if (studentDbId == null) {
      return { ok: false, response: NextResponse.json({ error: "Student not found" }, { status: 404 }) }
    }
    if (request.headers.get("x-course-id")) {
      const scope = await requireInstructorCourse(request)
      if (!scope.ok) return scope
      const sessionScope = readInstructorSessionScopeFromRequest(request)
      const pred = studentInSelectedCourseSqlForCourse(
        scope.course.id,
        scope.course.course_code,
        sessionScope,
      )
      const rows = await sql`
        SELECT s.id FROM students s
        WHERE s.id = ${studentDbId} AND ${sql.unsafe(pred)}
        LIMIT 1
      `
      if (!rows.length) {
        return { ok: false, response: forbiddenStudentResponse() }
      }
    }
    return { ok: true, studentDbId }
  }
  return requireStudentIdParamMatchesCaller(request, paramStudentId)
}

/**
 * Bind the caller session first. Unknown or mismatched claimed ids are 403
 * (no student-existence oracle for unauthenticated or cross-student probes).
 */
export async function requireBoundStudentCaller(
  request: NextRequest,
  claimedStudentId?: string | null,
): Promise<{ ok: true; studentDbId: number } | { ok: false; response: NextResponse }> {
  const caller = await requireCallerStudentDbId(request)
  if (!caller.ok) return caller
  if (!claimedStudentId?.trim()) {
    return { ok: true, studentDbId: caller.studentDbId }
  }
  const matches = await claimedIdMatchesSession(caller.studentDbId, claimedStudentId)
  if (!matches) {
    return { ok: false, response: forbiddenStudentResponse() }
  }
  return { ok: true, studentDbId: caller.studentDbId }
}

export async function requireAttemptOwnership(
  request: NextRequest,
  attemptId: number
): Promise<
  | { ok: true; studentDbId: number; attemptStudentId: number }
  | { ok: false; response: NextResponse }
> {
  if (!Number.isFinite(attemptId) || attemptId <= 0) {
    return { ok: false, response: NextResponse.json({ error: "Invalid attempt ID" }, { status: 400 }) }
  }

  // Faculty viewing a student attempt (e.g. results report backup panel) — same scope as instructor results view.
  const instructorId = await resolveInstructorIdFromSessionProof(request)
  if (instructorId != null && request.headers.get("x-course-id")?.trim()) {
    const { requireInstructorAttemptAccess } = await import("@/lib/instructor-results-auth")
    const access = await requireInstructorAttemptAccess(request, attemptId)
    if (!access.ok) return { ok: false, response: access.response }
    return {
      ok: true,
      studentDbId: access.studentId,
      attemptStudentId: access.studentId,
    }
  }

  const caller = await requireCallerStudentDbId(request)
  if (!caller.ok) return caller

  const rows = await sql`
    SELECT student_id FROM quiz_attempts
    WHERE id = ${attemptId} AND deleted_at IS NULL
    LIMIT 1
  `
  if (!rows.length) {
    return { ok: false, response: NextResponse.json({ error: "Attempt not found" }, { status: 404 }) }
  }

  const attemptStudentId = Number(rows[0].student_id)
  if (attemptStudentId !== caller.studentDbId) {
    return { ok: false, response: forbiddenStudentResponse() }
  }

  return { ok: true, studentDbId: caller.studentDbId, attemptStudentId }
}
