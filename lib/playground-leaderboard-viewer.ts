import { sql } from "@/lib/db"
import { normalizedSectionVariantsForSql } from "@/lib/session-code-aliases"

export type PlaygroundLeaderboardViewer = {
  dbId: number
  rosterStudentId: string
  section: string
  sectionVariants: string[]
  sessionId: number | null
}

/** Resolve the viewing student from a bound database id (not a raw header/query claim). */
export async function resolvePlaygroundLeaderboardViewer(
  studentDbId: number,
): Promise<PlaygroundLeaderboardViewer | null> {
  if (!Number.isFinite(studentDbId) || studentDbId <= 0) return null

  const rows = await sql`
    SELECT student_id, section, session_id
    FROM students
    WHERE id = ${studentDbId} AND deleted_at IS NULL
    LIMIT 1
  `
  if (rows.length === 0) return null

  const section = String(rows[0].section ?? "").trim()
  const sessionIdRaw = Number(rows[0].session_id)
  return {
    dbId: studentDbId,
    rosterStudentId: String(rows[0].student_id),
    section,
    sectionVariants: normalizedSectionVariantsForSql(section),
    sessionId: Number.isFinite(sessionIdRaw) && sessionIdRaw > 0 ? Math.trunc(sessionIdRaw) : null,
  }
}
