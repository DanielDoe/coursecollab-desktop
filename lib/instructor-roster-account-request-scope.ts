import { sql } from "@/lib/db"
import { normalizedSectionVariantsForSql } from "@/lib/session-code-aliases"

/** Roster request: applicant section resolves to a section that belongs to this platform course */
export async function rosterAccountRequestIsInCourse(
  platformCourseId: number,
  section: string | null | undefined,
): Promise<boolean> {
  const variants = normalizedSectionVariantsForSql(String(section ?? "").trim())
  if (variants.length === 0) return false
  const rows = await sql`
    SELECT 1 FROM sessions sess
    WHERE sess.course_id = ${platformCourseId}
      AND TRIM(sess.code) = ANY(${variants}::text[])
    LIMIT 1
  `
  return rows.length > 0
}
