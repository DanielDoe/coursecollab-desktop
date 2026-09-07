import { getSQL } from "@/lib/db"

const sql = getSQL()

/** Legacy assignments were created with session NULL and belong to ELEG courses only. */
function sqlLegacyElegNullSessionForCourse(courseId: number) {
  return sql`
    (
      cps.session IS NULL
      AND EXISTS (
        SELECT 1 FROM courses c
        WHERE c.id = ${courseId}
          AND c.course_code LIKE 'ELEG%'
      )
    )
  `
}

/** SQL fragment: classroom_point_submissions row alias must be `cps`. */
export function sqlSubmissionCourseScope(courseId: number) {
  return sql`
    AND (
      (
        cps.session IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM sessions sess
          WHERE TRIM(sess.code) = TRIM(cps.session)
            AND sess.course_id = ${courseId}
        )
      )
      OR ${sqlLegacyElegNullSessionForCourse(courseId)}
    )
  `
}

/** SQL fragment for manage list when filtering by session code (alias `cps`). */
export function sqlSubmissionSessionFilter(session: string, courseId: number | null) {
  if (courseId != null) {
    return sql`
      AND (
        TRIM(cps.session) = TRIM(${session})
        OR ${sqlLegacyElegNullSessionForCourse(courseId)}
      )
    `
  }
  return sql` AND (cps.session = ${session} OR cps.session IS NULL)`
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

export async function courseRequiresSubmissionSession(courseId: number): Promise<boolean> {
  const rows = await sql`
    SELECT course_code FROM courses WHERE id = ${courseId} LIMIT 1
  `
  const code = String((rows[0] as { course_code?: string } | undefined)?.course_code ?? "")
  return !code.startsWith("ELEG")
}

export async function submissionBelongsToCourse(
  submissionId: number,
  courseId: number,
): Promise<boolean> {
  const rows = await sql`
    SELECT 1 FROM classroom_point_submissions cps
    WHERE cps.id = ${submissionId}
      AND (
        (
          cps.session IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM sessions sess
            WHERE TRIM(sess.code) = TRIM(cps.session)
              AND sess.course_id = ${courseId}
          )
        )
        OR ${sqlLegacyElegNullSessionForCourse(courseId)}
      )
    LIMIT 1
  `
  return rows.length > 0
}
