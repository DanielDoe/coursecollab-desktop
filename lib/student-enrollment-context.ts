import { sql } from "@/lib/db"

export type StudentEnrollmentContext = {
  session: string | null
  courseId: number | null
}

/** Prefer `sessions.course_id` / `sessions.code` over stale `students.course_id` / `section`. */
export async function resolveStudentEnrollmentContext(
  studentDbId: number,
): Promise<StudentEnrollmentContext> {
  const rows = (await sql`
    SELECT
      COALESCE(NULLIF(TRIM(s.section), ''), NULLIF(TRIM(sess.code), '')) AS section,
      COALESCE(sess.course_id, s.course_id) AS course_id
    FROM students s
    LEFT JOIN sessions sess ON sess.id = s.session_id
    WHERE s.id = ${studentDbId} AND s.deleted_at IS NULL
    LIMIT 1
  `) as { section: string | null; course_id: number | null }[]

  if (rows.length === 0) {
    return { session: null, courseId: null }
  }

  const row = rows[0]
  return {
    session: row.section ?? null,
    courseId: row.course_id != null ? Number(row.course_id) : null,
  }
}
