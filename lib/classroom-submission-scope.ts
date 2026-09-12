import { getSQL } from "@/lib/db"

export { classroomAssignmentSessionMatchesStudent } from "@/lib/classroom-assignment-session-match"

const sql = getSQL()

/** SQL fragment: classroom_point_submissions row alias must be `cps`. */
export function sqlSubmissionCourseScope(courseId: number) {
  return sql`
    AND cps.session IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM sessions sess
      WHERE TRIM(sess.code) = TRIM(cps.session)
        AND sess.course_id = ${courseId}
    )
  `
}

/** SQL fragment for list when filtering by session code (alias `cps`). Exact match only. */
export function sqlSubmissionSessionFilter(session: string) {
  return sql` AND TRIM(cps.session) = TRIM(${session}) `
}

export async function sessionBelongsToCourse(
  sessionCode: string,
  courseId: number,
): Promise<boolean> {
  const rows = await sql`
    SELECT 1 FROM sessions
    WHERE TRIM(code) = TRIM(${sessionCode})
      AND course_id = ${courseId}
    LIMIT 1
  `
  return rows.length > 0
}

/** Prefer the session whose code matches the course, then any non-BETA section. */
export async function resolveDefaultCourseSession(courseId: number): Promise<string | null> {
  const rows = await sql`
    SELECT sess.code
    FROM sessions sess
    INNER JOIN courses c ON c.id = sess.course_id
    WHERE sess.course_id = ${courseId}
    ORDER BY
      CASE WHEN UPPER(TRIM(sess.code)) = UPPER(TRIM(c.course_code)) THEN 0 ELSE 1 END,
      CASE WHEN UPPER(TRIM(sess.code)) LIKE 'BETA%' THEN 2 ELSE 1 END,
      sess.code
    LIMIT 1
  `
  const code = String((rows[0] as { code?: string } | undefined)?.code ?? "").trim()
  return code || null
}

/** Every course must attach a session so 1301 / 1304 copies never share a NULL pool. */
export async function courseRequiresSubmissionSession(_courseId: number): Promise<boolean> {
  return true
}

export async function submissionBelongsToCourse(
  submissionId: number,
  courseId: number,
): Promise<boolean> {
  const rows = await sql`
    SELECT 1 FROM classroom_point_submissions cps
    WHERE cps.id = ${submissionId}
      AND cps.session IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM sessions sess
        WHERE TRIM(sess.code) = TRIM(cps.session)
          AND sess.course_id = ${courseId}
      )
    LIMIT 1
  `
  return rows.length > 0
}
