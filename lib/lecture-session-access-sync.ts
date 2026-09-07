import { sql as sqlTag } from "@/lib/db"
import { hasLectureSessionAccessTable } from "@/lib/instructor-default-courses"
import { resolveAllSessionRowsByCode } from "@/lib/resolve-session-by-code"

type SqlTemplate = typeof sqlTag

/** Normalize UI payload: string[] (enabled codes), Record, or null/undefined. */
export function normalizeLectureSessionAccessRecord(sessionAccess: unknown): Record<string, boolean> {
  if (sessionAccess == null) return {}
  if (Array.isArray(sessionAccess)) {
    const o: Record<string, boolean> = {}
    for (const x of sessionAccess) {
      if (typeof x === "string" && x.trim()) o[x.trim()] = true
    }
    return o
  }
  if (typeof sessionAccess === "object") {
    const o: Record<string, boolean> = {}
    for (const [k, v] of Object.entries(sessionAccess as Record<string, unknown>)) {
      o[k] = Boolean(v)
    }
    return o
  }
  return {}
}

/**
 * Replaces `lecture_session_access` rows for a lecture.
 * If `sessionAccess` is null/undefined (“all sections”), rows are cleared and the API should store `session_access` column as NULL.
 */
export async function replaceLectureSessionAccessFromRecord(
  sql: SqlTemplate,
  lectureId: number,
  sessionAccess: unknown,
): Promise<void> {
  if (!(await hasLectureSessionAccessTable())) return

  await sql`DELETE FROM lecture_session_access WHERE lecture_id = ${lectureId}`
  if (sessionAccess == null) return

  const record = normalizeLectureSessionAccessRecord(sessionAccess)

  for (const [sessionCode, isActive] of Object.entries(record)) {
    if (!isActive) continue
    const resolvedSessions = await resolveAllSessionRowsByCode(String(sessionCode))
    for (const resolved of resolvedSessions) {
      await sql`
        INSERT INTO lecture_session_access (lecture_id, session_id, is_active, updated_at)
        VALUES (${lectureId}, ${resolved.id}, true, CURRENT_TIMESTAMP)
        ON CONFLICT (lecture_id, session_id)
        DO UPDATE SET is_active = true, updated_at = CURRENT_TIMESTAMP
      `
    }
  }
}
