import type { getSQL } from "@/lib/db"

export const FALL_2026_ELEG_SESSION_CODES = ["ELEG1301P01", "ELEG1301P02", "ELEG1304P03"] as const

export type Fall2026ElegStudentRow = {
  id: number
  email: string | null
  full_name: string
  student_id: string
  session_code: string
  course_code: string
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

/** Fall 2026 ELEG section session ids only — never Spring rows that reuse the same codes. */
export async function getFall2026ElegSessionIds(sql: Sql): Promise<number[]> {
  const fallTermId = await getFall2026ElegTermId(sql)
  const rows = (await sql`
    SELECT sess.id
    FROM sessions sess
    WHERE TRIM(sess.code) = ANY(${FALL_2026_ELEG_SESSION_CODES})
      AND sess.academic_term_id = ${fallTermId}
    ORDER BY sess.code ASC, sess.id ASC
  `) as { id: number }[]
  return rows.map((r) => Number(r.id))
}

export async function loadFall2026ElegStudents(sql: Sql): Promise<Fall2026ElegStudentRow[]> {
  const fallTermId = await getFall2026ElegTermId(sql)
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
    WHERE TRIM(sess.code) = ANY(${FALL_2026_ELEG_SESSION_CODES})
      AND sess.academic_term_id = ${fallTermId}
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
