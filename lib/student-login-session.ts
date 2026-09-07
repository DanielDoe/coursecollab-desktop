import { getSQL } from "@/lib/db"
import { getActiveAcademicTerm } from "@/lib/active-academic-term"
import { courseUsesLabSections, defaultSessionCodeForCourse } from "@/lib/course-section-model"
import { sectionFilterCodesForSql } from "@/lib/session-code-aliases"

/** Resolve a catalog session for login — any academic term; prefer active term when tied. */
export async function resolveSessionForCourseLogin(
  courseId: number,
  section: string,
  preferredSessionId?: number | null,
): Promise<{ sessionId: number; sectionCode: string } | null> {
  const sql = getSQL()

  if (preferredSessionId != null && Number.isFinite(preferredSessionId)) {
    const preferred = (await sql`
      SELECT id, code FROM sessions
      WHERE id = ${preferredSessionId} AND course_id = ${courseId}
      LIMIT 1
    `) as { id: number; code: string }[]
    if (preferred.length > 0) {
      return { sessionId: Number(preferred[0].id), sectionCode: String(preferred[0].code) }
    }
  }

  const activeTerm = await getActiveAcademicTerm()
  const activeTermId = activeTerm?.id ?? null

  const courseRows = (await sql`
    SELECT course_code FROM courses WHERE id = ${courseId} AND is_active = true LIMIT 1
  `) as { course_code?: string }[]
  const courseCode = String(courseRows[0]?.course_code ?? "")
  const variants = sectionFilterCodesForSql(section)

  if (variants.length > 0) {
    const rows = activeTermId
      ? ((await sql`
          SELECT id, code FROM sessions
          WHERE course_id = ${courseId}
            AND TRIM(code) = ANY(${variants}::text[])
          ORDER BY
            CASE WHEN academic_term_id = ${activeTermId} THEN 0 ELSE 1 END,
            academic_term_id DESC NULLS LAST,
            CASE WHEN code LIKE 'ELEG%' THEN 0 ELSE 1 END,
            code
          LIMIT 1
        `) as { id: number; code: string }[])
      : ((await sql`
          SELECT id, code FROM sessions
          WHERE course_id = ${courseId}
            AND TRIM(code) = ANY(${variants}::text[])
          ORDER BY
            academic_term_id DESC NULLS LAST,
            CASE WHEN code LIKE 'ELEG%' THEN 0 ELSE 1 END,
            code
          LIMIT 1
        `) as { id: number; code: string }[])

    if (rows.length > 0) {
      return { sessionId: Number(rows[0].id), sectionCode: String(rows[0].code) }
    }
  }

  if (!courseUsesLabSections(courseCode)) {
    const defaultCode = defaultSessionCodeForCourse(courseCode)
    if (defaultCode) {
      const defaultRows = activeTermId
        ? ((await sql`
            SELECT id, code FROM sessions
            WHERE course_id = ${courseId}
              AND TRIM(UPPER(code)) = TRIM(UPPER(${defaultCode}))
            ORDER BY
              CASE WHEN academic_term_id = ${activeTermId} THEN 0 ELSE 1 END,
              academic_term_id DESC NULLS LAST
            LIMIT 1
          `) as { id: number; code: string }[])
        : ((await sql`
            SELECT id, code FROM sessions
            WHERE course_id = ${courseId}
              AND TRIM(UPPER(code)) = TRIM(UPPER(${defaultCode}))
            ORDER BY academic_term_id DESC NULLS LAST
            LIMIT 1
          `) as { id: number; code: string }[])

      if (defaultRows.length > 0) {
        return { sessionId: Number(defaultRows[0].id), sectionCode: String(defaultRows[0].code) }
      }
    }
  }

  return null
}
