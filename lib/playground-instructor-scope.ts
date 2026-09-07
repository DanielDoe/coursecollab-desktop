import { type NextRequest } from "next/server"
import { sql } from "@/lib/db"
import {
  resolveAttendanceInstructorScope,
  type AttendanceInstructorScope,
} from "@/lib/attendance-instructor-scope"
import { studentInInstructorSessionScopeSql } from "@/lib/instructor-session-scope"

export type PlaygroundInstructorScope = AttendanceInstructorScope

export async function resolvePlaygroundInstructorScope(
  request: NextRequest,
): Promise<PlaygroundInstructorScope> {
  return resolveAttendanceInstructorScope(request)
}

async function resolvePlaygroundEffectiveTermId(
  scope: PlaygroundInstructorScope,
): Promise<number | null> {
  if (scope.academicTermId != null) {
    return scope.academicTermId
  }
  if (scope.sessionId == null) return null

  const rows = (await sql`
    SELECT academic_term_id FROM sessions WHERE id = ${scope.sessionId} LIMIT 1
  `) as { academic_term_id: number | null }[]
  const tid = rows[0]?.academic_term_id
  return tid != null && Number.isFinite(Number(tid)) && Number(tid) > 0 ? Math.trunc(Number(tid)) : null
}

/** Match playground_results.student_id to a students row (login id or numeric pk). */
export function playgroundResultMatchesStudentSql(
  resultStudentIdColumnSql: string,
  studentAlias = "s_pg",
): string {
  const col = resultStudentIdColumnSql.trim() || "pr.student_id"
  const a = studentAlias.trim() || "s_pg"
  return `(${a}.student_id = ${col} OR ${col} = ${a}.id::text)`
}

/**
 * List/manage playgrounds for the selected term.
 * When a class section is selected, hide games that only other sections played.
 * Legacy NULL allowed_sessions stay visible if empty or if this section has results.
 */
export async function sqlPlaygroundTermScope(request: NextRequest, tableAlias = "ps") {
  const scope = await resolvePlaygroundInstructorScope(request)
  const termId = await resolvePlaygroundEffectiveTermId(scope)
  if (termId == null) return sql``

  const a = tableAlias.trim() || "ps"
  const termPredicate = `
      ${a}.allowed_sessions IS NULL
      OR cardinality(${a}.allowed_sessions) = 0
      OR (
        EXISTS (
          SELECT 1 FROM unnest(${a}.allowed_sessions) AS aid
          INNER JOIN sessions sess ON sess.id = aid
          WHERE sess.academic_term_id = ${termId}
        )
        AND NOT EXISTS (
          SELECT 1 FROM unnest(${a}.allowed_sessions) AS aid
          INNER JOIN sessions sess ON sess.id = aid
          WHERE sess.academic_term_id IS DISTINCT FROM ${termId}
        )
      )
  `

  if (scope.sessionId == null) {
    return sql.unsafe(`AND (${termPredicate})`)
  }

  const sid = scope.sessionId
  return sql.unsafe(`
    AND (${termPredicate})
    AND (
      (
        ${a}.allowed_sessions IS NOT NULL
        AND cardinality(${a}.allowed_sessions) > 0
        AND ${a}.allowed_sessions && ARRAY[${sid}]::int[]
      )
      OR (
        (${a}.allowed_sessions IS NULL OR cardinality(${a}.allowed_sessions) = 0)
        AND (
          NOT EXISTS (
            SELECT 1 FROM playground_results pr_scope
            WHERE pr_scope.session_id = ${a}.id
          )
          OR EXISTS (
            SELECT 1 FROM playground_results pr_scope
            INNER JOIN students s_scope ON s_scope.deleted_at IS NULL
              AND ${playgroundResultMatchesStudentSql("pr_scope.student_id", "s_scope")}
            WHERE pr_scope.session_id = ${a}.id
              AND s_scope.session_id = ${sid}
          )
        )
      )
    )
  `)
}

/** Section ids used when opening/starting — falls back to instructor header session. */
export async function resolvePlaygroundActivationAllowedIds(
  request: NextRequest,
  rowAllowedSessions: number[] | null | undefined,
): Promise<number[] | null> {
  const fromRow = normalizeAllowedSessionIds(rowAllowedSessions)
  if (fromRow.length > 0) return fromRow

  const scope = await resolvePlaygroundInstructorScope(request)
  if (scope.sessionId != null) return [scope.sessionId]
  return null
}

function normalizeAllowedSessionIds(raw: number[] | null | undefined): number[] {
  if (!raw?.length) return []
  return raw
    .map((id) => Math.trunc(Number(id)))
    .filter((id) => Number.isFinite(id) && id > 0)
}

/**
 * Activation guard: only touch lobbies/live games that share a class section
 * with the playground being opened or started.
 */
export function sqlPlaygroundAllowedSessionsOverlapScope(
  allowedSessionIds: number[] | null | undefined,
  tableAlias = "ps",
) {
  const a = tableAlias.trim() || "ps"
  const ids = normalizeAllowedSessionIds(allowedSessionIds)
  if (ids.length === 0) {
    return sql.unsafe(`(FALSE)`)
  }
  return sql.unsafe(`(
    ${a}.allowed_sessions IS NOT NULL
    AND cardinality(${a}.allowed_sessions) > 0
    AND ${a}.allowed_sessions && ARRAY[${ids.join(",")}]::int[]
  )`)
}

export async function loadPlaygroundAllowedSessionIds(
  playgroundSessionId: number,
): Promise<number[] | null> {
  const rows = (await sql`
    SELECT allowed_sessions FROM playground_sessions WHERE id = ${playgroundSessionId} LIMIT 1
  `) as { allowed_sessions: number[] | null }[]
  if (rows.length === 0) return null
  const ids = normalizeAllowedSessionIds(rows[0].allowed_sessions)
  return ids.length > 0 ? ids : null
}

/** Default allowed class sections when creating a new playground row. */
export async function resolvePlaygroundAllowedSessionsForCreate(
  request: NextRequest,
  explicit: number[] | null | undefined,
): Promise<number[] | null> {
  if (explicit && Array.isArray(explicit) && explicit.length > 0) {
    return normalizeAllowedSessionIds(explicit)
  }

  const scope = await resolvePlaygroundInstructorScope(request)
  if (scope.sessionId != null) {
    return [scope.sessionId]
  }

  return null
}

/** Limit playground result rows to students on the instructor's selected section/term roster. */
function playgroundResultRosterExistsSql(
  courseId: number,
  scope: AttendanceInstructorScope,
  resultStudentIdColumnSql: string,
): string {
  const col = resultStudentIdColumnSql.trim() || "pr.student_id"
  const predicate = studentInInstructorSessionScopeSql({
    courseId,
    sessionId: scope.sessionId,
    academicTermId: scope.sessionId != null ? null : scope.academicTermId,
    studentAlias: "s_pg",
  })
  return `EXISTS (
    SELECT 1 FROM students s_pg
    WHERE ${playgroundResultMatchesStudentSql(col, "s_pg")}
      AND s_pg.deleted_at IS NULL
      AND ${predicate}
  )`
}

export async function sqlPlaygroundResultRosterScope(
  request: NextRequest,
  courseId: number,
  resultStudentIdColumnSql: string,
) {
  const scope = await resolvePlaygroundInstructorScope(request)
  if (scope.sessionId == null && scope.academicTermId == null) return sql``

  return sql.unsafe(` AND ${playgroundResultRosterExistsSql(courseId, scope, resultStudentIdColumnSql)}`)
}

/** Use inside LEFT JOIN ... ON when aggregating stats without dropping empty sessions. */
export async function sqlPlaygroundResultRosterJoinOnScope(
  request: NextRequest,
  courseId: number,
  resultStudentIdColumnSql: string,
) {
  const scope = await resolvePlaygroundInstructorScope(request)
  if (scope.sessionId == null && scope.academicTermId == null) return sql``

  return sql.unsafe(` AND ${playgroundResultRosterExistsSql(courseId, scope, resultStudentIdColumnSql)}`)
}

/** @deprecated Use sqlPlaygroundTermScope for reads and overlap scope for activation. */
export const sqlPlaygroundSectionScope = sqlPlaygroundTermScope
