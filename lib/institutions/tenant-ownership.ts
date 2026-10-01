import { sql } from "@/lib/db"

export type CourseInstitutionOwnership = {
  institutionId: number
  courseId: number
}

export type SessionInstitutionOwnership = {
  institutionId: number
  courseId: number
  sessionId: number
}

/**
 * Resolve the institution that owns a course from `courses.university_id`.
 * Does not infer from course code, prefix, email, or environment.
 * Returns null when the course is missing or has no university_id.
 * Does not authorize the caller.
 */
export async function resolveCourseInstitution(
  courseId: number,
): Promise<CourseInstitutionOwnership | null> {
  const id = Math.trunc(Number(courseId))
  if (!Number.isFinite(id) || id < 1) return null
  const rows = (await sql`
    SELECT c.id AS course_id, c.university_id AS institution_id
    FROM courses c
    WHERE c.id = ${id}
      AND c.university_id IS NOT NULL
    LIMIT 1
  `) as { course_id: number; institution_id: number }[]
  const row = rows[0]
  if (!row) return null
  return {
    institutionId: Number(row.institution_id),
    courseId: Number(row.course_id),
  }
}

/**
 * Resolve the institution that owns a session via session → course → university.
 * Does not authorize the caller.
 */
export async function resolveSessionInstitution(
  sessionId: number,
): Promise<SessionInstitutionOwnership | null> {
  const id = Math.trunc(Number(sessionId))
  if (!Number.isFinite(id) || id < 1) return null
  const rows = (await sql`
    SELECT
      s.id AS session_id,
      s.course_id AS course_id,
      c.university_id AS institution_id
    FROM sessions s
    INNER JOIN courses c ON c.id = s.course_id
    WHERE s.id = ${id}
      AND c.university_id IS NOT NULL
    LIMIT 1
  `) as { session_id: number; course_id: number; institution_id: number }[]
  const row = rows[0]
  if (!row) return null
  return {
    institutionId: Number(row.institution_id),
    courseId: Number(row.course_id),
    sessionId: Number(row.session_id),
  }
}
