import type { getSQL } from "@/lib/db"

export const FALL_2026_ELEG_SESSION_CODES = ["ELEG1301P01", "ELEG1301P02", "ELEG1304P03"] as const

/** Primary instructor for live PVAMU ELEG Fall 2026 sections. */
export const FALL_2026_ELEG_INSTRUCTOR_ID = 1

export type Fall2026ElegStudentRow = {
  id: number
  email: string | null
  full_name: string
  student_id: string
  session_code: string
  course_code: string
}

export type Fall2026ElegCanonicalSession = {
  session_id: number
  session_code: string
  course_id: number
  instructor_id: number
  student_count: number
}

type Sql = ReturnType<typeof getSQL>

export async function getFall2026ElegTermId(sql: Sql): Promise<number> {
  const rows = (await sql`
    SELECT id FROM academic_terms
    WHERE year = 2026 AND term = 'Fall'
    LIMIT 1
  `) as { id: number }[]
  if (!rows.length) throw new Error("Fall 2026 academic term not found")
  return Number(rows[0].id)
}

/**
 * One session row per Fall 2026 ELEG section — prefers Daniel Doe's course shells (instructor 1)
 * and the session with the most active enrollments when duplicates exist.
 */
export async function loadFall2026ElegCanonicalSessions(
  sql: Sql,
): Promise<Fall2026ElegCanonicalSession[]> {
  const fallTermId = await getFall2026ElegTermId(sql)
  const rows = (await sql`
    SELECT DISTINCT ON (sess.code)
      sess.id AS session_id,
      TRIM(sess.code) AS session_code,
      sess.course_id,
      c.instructor_id,
      (
        SELECT COUNT(*)::int
        FROM students s
        WHERE s.session_id = sess.id
          AND s.deleted_at IS NULL
      ) AS student_count
    FROM sessions sess
    INNER JOIN courses c ON c.id = sess.course_id
    WHERE TRIM(sess.code) = ANY(${FALL_2026_ELEG_SESSION_CODES})
      AND sess.academic_term_id = ${fallTermId}
      AND c.instructor_id = ${FALL_2026_ELEG_INSTRUCTOR_ID}
    ORDER BY sess.code ASC, student_count DESC, sess.id ASC
  `) as Fall2026ElegCanonicalSession[]

  return rows.map((r) => ({
    session_id: Number(r.session_id),
    session_code: String(r.session_code),
    course_id: Number(r.course_id),
    instructor_id: Number(r.instructor_id),
    student_count: Number(r.student_count),
  }))
}

/** Fall 2026 canonical section session ids — never orphan/demo duplicate rows. */
export async function getFall2026ElegSessionIds(sql: Sql): Promise<number[]> {
  const sessions = await loadFall2026ElegCanonicalSessions(sql)
  return sessions.map((s) => s.session_id)
}

export async function loadFall2026ElegStudents(sql: Sql): Promise<Fall2026ElegStudentRow[]> {
  const canonical = await loadFall2026ElegCanonicalSessions(sql)
  const sessionIds = canonical.map((s) => s.session_id)
  if (sessionIds.length === 0) return []

  const rows = await sql`
    SELECT
      s.id,
      s.email,
      s.full_name,
      s.student_id,
      sess.code AS session_code,
      c.course_code
    FROM students s
    INNER JOIN sessions sess ON sess.id = s.session_id
    INNER JOIN courses c ON c.id = sess.course_id
    WHERE s.session_id = ANY(${sessionIds})
      AND s.deleted_at IS NULL
      AND COALESCE(s.student_id, '') NOT ILIKE 'dmdoe%'
      AND COALESCE(s.sis_user_id, '') NOT ILIKE 'DEMO%'
    ORDER BY sess.code ASC, s.full_name ASC
  `
  return rows as Fall2026ElegStudentRow[]
}

export function dedupeStudentsByEmail<T extends { email: string | null }>(
  rows: T[],
  isValidEmail: (email: string | null | undefined) => boolean,
): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const row of rows) {
    if (!isValidEmail(row.email)) continue
    const key = row.email!.trim().toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ ...row, email: row.email!.trim() } as T)
  }
  return out
}
