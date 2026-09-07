import { type NextRequest } from "next/server"
import { sql } from "@/lib/db"

export type InstructorSessionScope = {
  sessionId: number | null
  academicTermId: number | null
}

function parsePositiveInt(raw: string | null): number | null {
  if (!raw?.trim()) return null
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null
}

/** Reads optional section/term scope from instructor API headers. */
export function readInstructorSessionScopeFromRequest(request: NextRequest): InstructorSessionScope {
  return {
    sessionId: parsePositiveInt(request.headers.get("x-session-id")),
    academicTermId: parsePositiveInt(request.headers.get("x-academic-term-id")),
  }
}

/** Resolve the instructor's selected section code from API headers. */
export async function resolveInstructorSessionCodeForScope(
  request: NextRequest,
): Promise<string | null> {
  const scope = readInstructorSessionScopeFromRequest(request)
  if (scope.sessionId == null) return null
  const rows = (await sql`
    SELECT code FROM sessions WHERE id = ${scope.sessionId} LIMIT 1
  `) as { code: string }[]
  return rows[0]?.code?.trim() ?? null
}

/** SQL predicate: student belongs to instructor's selected section/term on this course. */
export function studentInInstructorSessionScopeSql(input: {
  courseId: number
  sessionId?: number | null
  academicTermId?: number | null
  /** Student table alias in the surrounding query (default `s`). */
  studentAlias?: string
}): string {
  const cid = Math.trunc(Number(input.courseId))
  if (!Number.isFinite(cid) || cid < 1) return "(FALSE)"
  const alias = input.studentAlias?.trim() || "s"

  const sessionId =
    input.sessionId != null && Number.isFinite(input.sessionId) && input.sessionId > 0
      ? Math.trunc(input.sessionId)
      : null
  const termId =
    input.academicTermId != null && Number.isFinite(input.academicTermId) && input.academicTermId > 0
      ? Math.trunc(input.academicTermId)
      : null

  if (sessionId != null) {
    return `(
      ${alias}.session_id = ${sessionId}
      AND EXISTS (
        SELECT 1 FROM sessions sess_scope
        WHERE sess_scope.id = ${sessionId}
          AND sess_scope.course_id = ${cid}
      )
    )`
  }

  if (termId != null) {
    return `(
      (
        ${alias}.course_id = ${cid}
        OR EXISTS (
          SELECT 1 FROM sessions sess_scoped
          WHERE sess_scoped.id = ${alias}.session_id AND sess_scoped.course_id = ${cid}
        )
      )
      AND EXISTS (
        SELECT 1 FROM sessions sess_term
        WHERE sess_term.id = ${alias}.session_id
          AND sess_term.course_id = ${cid}
          AND sess_term.academic_term_id = ${termId}
      )
    )`
  }

  return `(
    ${alias}.course_id = ${cid}
    OR EXISTS (
      SELECT 1 FROM sessions sess_scoped
      WHERE sess_scoped.id = ${alias}.session_id AND sess_scoped.course_id = ${cid}
    )
  )`
}
