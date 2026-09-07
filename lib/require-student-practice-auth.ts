import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import {
  forbiddenStudentResponse,
  requireBoundStudentCaller,
  requireCallerStudentDbId,
} from "@/lib/student-api-auth"
import {
  resolveStudentPracticeContextForCaller,
  type StudentPracticeContext,
} from "@/lib/student-practice-scope"

export async function requireStudentPracticeCaller(
  request: NextRequest,
  claimedStudentId?: string | null,
  sessionParam?: string | null,
  courseIdParam?: string | null,
): Promise<
  | { ok: true; studentDbId: number; ctx: StudentPracticeContext }
  | { ok: false; response: NextResponse }
> {
  const url = new URL(request.url)
  const claimed = claimedStudentId !== undefined ? claimedStudentId : url.searchParams.get("studentId")
  const session = sessionParam !== undefined ? sessionParam : url.searchParams.get("session")
  const courseId = courseIdParam !== undefined ? courseIdParam : url.searchParams.get("courseId")

  const auth = await requireBoundStudentCaller(request, claimed)
  if (!auth.ok) return auth

  const scope = await resolveStudentPracticeContextForCaller(auth.studentDbId, session, courseId)
  if (!scope.ok) return scope

  return { ok: true, studentDbId: auth.studentDbId, ctx: scope.ctx }
}

export async function requirePracticeAttemptOwnership(
  request: NextRequest,
  attemptId: number,
): Promise<
  | { ok: true; studentDbId: number; attemptStudentId: number }
  | { ok: false; response: NextResponse }
> {
  if (!Number.isFinite(attemptId) || attemptId <= 0) {
    return { ok: false, response: NextResponse.json({ error: "Invalid attempt ID" }, { status: 400 }) }
  }

  const caller = await requireCallerStudentDbId(request)
  if (!caller.ok) return caller

  const rows = await sql`
    SELECT student_id FROM practice_attempts
    WHERE id = ${attemptId}
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
