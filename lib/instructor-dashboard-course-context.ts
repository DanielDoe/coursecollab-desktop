import { type NextRequest } from "next/server"
import { sql } from "@/lib/db"
import type { ScopedCourseRow } from "@/lib/instructor-course-scope"
import { normalizeCatalogCourseCode } from "@/lib/course-section-model"
import { readInstructorSessionScopeFromRequest } from "@/lib/instructor-session-scope"

export type InstructorDashboardCourseContext = {
  courseId: number
  courseCode: string
}

/** Umbrella catalog course for dashboard KPIs when the header points at a section-shell course row. */
async function resolveUmbrellaCourseFromSectionShell(
  courseCode: string,
): Promise<{ id: number; course_code: string } | null> {
  const normalized = normalizeCatalogCourseCode(courseCode)
  const sectionMatch = normalized.match(/^([A-Z]+\d{4})P\d+$/i)
  if (!sectionMatch) return null
  const umbrellaCode = sectionMatch[1]!.toUpperCase()
  const rows = await sql`
    SELECT id, course_code
    FROM courses
    WHERE TRIM(UPPER(REPLACE(course_code, ' ', ''))) = ${umbrellaCode}
      AND is_active = true
    ORDER BY id ASC
    LIMIT 1
  `
  if (rows.length === 0) return null
  const row = rows[0] as { id: number; course_code: string }
  return { id: Number(row.id), course_code: String(row.course_code) }
}

/**
 * KPI/chart scope must use the umbrella course that owns quizzes and sessions.
 * Fixes stale localStorage where x-course-id is a section-shell (19) but x-session-id
 * points at a session on the umbrella course (5).
 */
export async function resolveInstructorDashboardCourseContext(
  request: NextRequest,
  scopedCourse: ScopedCourseRow,
): Promise<InstructorDashboardCourseContext> {
  let courseId = scopedCourse.id
  let courseCode = scopedCourse.course_code
  const sessionScope = readInstructorSessionScopeFromRequest(request)

  if (sessionScope.sessionId != null) {
    const rows = await sql`
      SELECT s.course_id, c.course_code
      FROM sessions s
      INNER JOIN courses c ON c.id = s.course_id
      WHERE s.id = ${sessionScope.sessionId}
      LIMIT 1
    `
    if (rows.length > 0) {
      const row = rows[0] as { course_id: number; course_code: string }
      const sessionCourseId = Number(row.course_id)
      // Ignore stale x-session-id from another course (e.g. ELEG P01 left in storage after picking ECE2202).
      if (sessionCourseId === courseId) {
        return {
          courseId: sessionCourseId,
          courseCode: String(row.course_code),
        }
      }
    }
  }

  const umbrella = await resolveUmbrellaCourseFromSectionShell(courseCode)
  if (umbrella && umbrella.id !== courseId) {
    return { courseId: umbrella.id, courseCode: umbrella.course_code }
  }

  return { courseId, courseCode }
}
