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

/** Selected catalog course + section/term from instructor API headers. */
export function readInstructorOfferingFromRequest(request: NextRequest): InstructorSessionScope & {
  courseId: number | null
} {
  return {
    courseId: parsePositiveInt(request.headers.get("x-course-id")),
    ...readInstructorSessionScopeFromRequest(request),
  }
}

/** quiz_issues.reporter_id is email, login, or numeric pk — keep only the selected offering. */
export function issueReporterInOfferingSql(input: {
  courseId: number
  sessionId?: number | null
  academicTermId?: number | null
}): string {
  const pred = studentInInstructorSessionScopeSql({
    courseId: input.courseId,
    sessionId: input.sessionId,
    academicTermId: input.sessionId != null ? null : input.academicTermId,
    studentAlias: "s",
  })
  return `(
    EXISTS (
      SELECT 1 FROM students s
      WHERE s.deleted_at IS NULL
        AND ${pred}
        AND (
          s.id::text = TRIM(COALESCE(qi.reporter_id, ''))
          OR s.student_id = TRIM(COALESCE(qi.reporter_id, ''))
          OR LOWER(COALESCE(s.email, '')) = LOWER(TRIM(COALESCE(qi.reporter_id, '')))
        )
    )
  )`
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

  // Never return every student on the catalog course. Section codes like ELEG1301P01
  // are reused across terms; without a selected session, keep the active term only.
  return `(
    (
      ${alias}.course_id = ${cid}
      OR EXISTS (
        SELECT 1 FROM sessions sess_scoped
        WHERE sess_scoped.id = ${alias}.session_id AND sess_scoped.course_id = ${cid}
      )
    )
    AND (
      ${alias}.session_id IS NULL
      OR EXISTS (
        SELECT 1 FROM sessions sess_term
        WHERE sess_term.id = ${alias}.session_id
          AND sess_term.course_id = ${cid}
          AND (
            sess_term.academic_term_id IS NULL
            OR EXISTS (
              SELECT 1 FROM academic_terms at
              WHERE at.id = sess_term.academic_term_id
                AND COALESCE(at.is_active, false) = true
            )
          )
      )
    )
  )`
}

/** Catalog session row belongs to the selected offering (session id, else term, else active term). */
export function sessionInInstructorOfferingSql(input: {
  courseId: number
  sessionId?: number | null
  academicTermId?: number | null
  sessionAlias?: string
}): string {
  const cid = Math.trunc(Number(input.courseId))
  if (!Number.isFinite(cid) || cid < 1) return "(FALSE)"
  const alias = input.sessionAlias?.trim() || "s"

  const sessionId =
    input.sessionId != null && Number.isFinite(input.sessionId) && input.sessionId > 0
      ? Math.trunc(input.sessionId)
      : null
  const termId =
    input.academicTermId != null && Number.isFinite(input.academicTermId) && input.academicTermId > 0
      ? Math.trunc(input.academicTermId)
      : null

  if (sessionId != null) {
    return `(${alias}.id = ${sessionId} AND ${alias}.course_id = ${cid})`
  }
  if (termId != null) {
    return `(${alias}.course_id = ${cid} AND ${alias}.academic_term_id = ${termId})`
  }
  return `(
    ${alias}.course_id = ${cid}
    AND (
      ${alias}.academic_term_id IS NULL
      OR EXISTS (
        SELECT 1 FROM academic_terms at
        WHERE at.id = ${alias}.academic_term_id
          AND COALESCE(at.is_active, false) = true
      )
    )
  )`
}

export function studentInOfferingSqlFromRequest(
  request: NextRequest,
  courseId: number,
  studentAlias = "s",
): string {
  const scope = readInstructorSessionScopeFromRequest(request)
  return studentInInstructorSessionScopeSql({
    courseId,
    sessionId: scope.sessionId,
    academicTermId: scope.sessionId != null ? null : scope.academicTermId,
    studentAlias,
  })
}

/** `AND <student in offering>` — empty when courseId is missing. */
export function studentOfferingAndSql(
  request: NextRequest,
  courseId: number | null | undefined,
  studentAlias = "s",
) {
  const cid = Math.trunc(Number(courseId))
  if (!Number.isFinite(cid) || cid < 1) return sql.unsafe("")
  return sql.unsafe(`AND ${studentInOfferingSqlFromRequest(request, cid, studentAlias)}`)
}

/** `AND <session in offering>` — empty when courseId is missing. */
export function sessionOfferingAndSql(
  request: NextRequest,
  courseId: number | null | undefined,
  sessionAlias = "s",
) {
  const cid = Math.trunc(Number(courseId))
  if (!Number.isFinite(cid) || cid < 1) return sql.unsafe("")
  const scope = readInstructorSessionScopeFromRequest(request)
  return sql.unsafe(
    `AND ${sessionInInstructorOfferingSql({
      courseId: cid,
      sessionId: scope.sessionId,
      academicTermId: scope.sessionId != null ? null : scope.academicTermId,
      sessionAlias,
    })}`,
  )
}
