import { sql } from "@/lib/db"

/**
 * Resolve `students.id` from a query param that may be the internal id OR `students.student_id`
 * (e.g. numeric school ID). Prefer matching `student_id` first so a numeric login id is not
 * mistaken for a primary key when both differ.
 */
export async function resolveStudentDatabaseIdFromParam(raw: string): Promise<number | null> {
  const trimmed = raw.trim()
  if (!trimmed) return null

  const byStudentIdCol = await sql`
    SELECT id FROM students WHERE student_id = ${trimmed} LIMIT 1
  `
  if (byStudentIdCol.length > 0 && byStudentIdCol[0]?.id != null) {
    return Number(byStudentIdCol[0].id)
  }

  if (/^\d+$/.test(trimmed)) {
    const parsed = parseInt(trimmed, 10)
    if (!Number.isNaN(parsed) && parsed > 0) {
      const byPk = await sql`
        SELECT id FROM students WHERE id = ${parsed} LIMIT 1
      `
      if (byPk.length > 0 && byPk[0]?.id != null) {
        return Number(byPk[0].id)
      }
    }
  }

  return null
}
