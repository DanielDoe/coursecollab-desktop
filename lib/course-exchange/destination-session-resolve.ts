import { sql } from "@/lib/db"
import { getActiveAcademicTerm } from "@/lib/active-academic-term"
import { isOwnGroupsProjectsSession } from "@/lib/course-exchange/groups-projects-session-policy"

/** Resolve the destination section code for Course Exchange policy (groups/projects skip, assignment remap). */
export async function resolveExchangeDestinationSessionCode(
  destinationCourseId: number,
  destinationSessionId?: number | null,
): Promise<string | null> {
  if (destinationSessionId != null && Number.isFinite(Number(destinationSessionId))) {
    const rows = (await sql`
      SELECT code, course_id FROM sessions
      WHERE id = ${Number(destinationSessionId)}
      LIMIT 1
    `) as { code: string; course_id: number }[]
    const row = rows[0]
    if (!row) return null
    if (Number(row.course_id) !== destinationCourseId) return null
    return String(row.code).trim() || null
  }

  const courseRows = (await sql`
    SELECT course_code FROM courses WHERE id = ${destinationCourseId} LIMIT 1
  `) as { course_code: string }[]
  const courseCode = courseRows[0]?.course_code
  if (isOwnGroupsProjectsSession(courseCode)) {
    return String(courseCode).trim()
  }

  const activeTerm = await getActiveAcademicTerm()
  if (activeTerm?.id) {
    const sessionRows = (await sql`
      SELECT code FROM sessions
      WHERE course_id = ${destinationCourseId}
        AND academic_term_id = ${activeTerm.id}
        AND TRIM(UPPER(code)) <> 'BETA'
      ORDER BY code ASC
    `) as { code: string }[]
    for (const row of sessionRows) {
      if (isOwnGroupsProjectsSession(row.code)) return String(row.code).trim()
    }
    if (sessionRows.length === 1) {
      return String(sessionRows[0]!.code).trim() || null
    }
  }

  return null
}
