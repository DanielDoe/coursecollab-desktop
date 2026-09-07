import { sql } from "@/lib/db"
import { normalizedSectionVariantsForSql } from "@/lib/session-code-aliases"

/** All `sessions` rows for a code within a course (handles duplicate ECE2202 rows). */
export async function resolveAllSessionRowsByCode(
  code: string,
  courseId?: number | null,
): Promise<Array<{ id: number; code: string }>> {
  const variants = normalizedSectionVariantsForSql(String(code ?? "").trim())
  if (variants.length === 0) return []
  const cid =
    courseId != null && Number.isFinite(Number(courseId)) ? Math.trunc(Number(courseId)) : null
  const rows =
    cid != null
      ? await sql`
          SELECT id, code FROM sessions
          WHERE course_id = ${cid}
            AND TRIM(code) = ANY(${variants}::text[])
          ORDER BY id ASC
        `
      : await sql`
          SELECT id, code FROM sessions
          WHERE TRIM(code) = ANY(${variants}::text[])
          ORDER BY id ASC
        `
  return (rows as { id: number; code: string }[]).map((r) => ({
    id: Number(r.id),
    code: String(r.code),
  }))
}

/** Match `sessions` row from instructor/UI code (legacy E1304P01 or canonical ELEG1304P01). */
export async function resolveSessionRowByCode(
  code: string,
  courseId?: number | null,
): Promise<{ id: number; code: string } | null> {
  const rows = await resolveAllSessionRowsByCode(code, courseId)
  if (rows.length === 0) return null
  return rows[0]
}

/** Map UI/session_access keys to `sessions.code` so quiz_session_access INSERT joins succeed after renames. */
export async function normalizeSessionAccessRecordToCanonical(
  sessionAccess: Record<string, boolean> | null | undefined,
): Promise<Record<string, boolean>> {
  if (!sessionAccess || typeof sessionAccess !== "object") return {}
  const out: Record<string, boolean> = {}
  for (const [code, active] of Object.entries(sessionAccess)) {
    const resolved = await resolveSessionRowByCode(String(code))
    if (resolved) {
      out[resolved.code] = Boolean(active) || Boolean(out[resolved.code])
    }
  }
  return out
}
