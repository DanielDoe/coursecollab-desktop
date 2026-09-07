import { sql } from "@/lib/db"
import { normalizeCatalogCourseCode } from "@/lib/course-section-model"

/** Join student catalog session so evaluations can be scoped by `sessions.course_id`. */
export const COURSE_EVALUATION_SESSION_JOIN = sql.unsafe(`
  LEFT JOIN sessions sess ON sess.id = s.session_id
`)

/**
 * Keep evaluations for students in the selected course.
 * Matches `students.course_id`, the student's catalog session, or denormalized
 * section/session text (ECE2202, ELEG1301P01, …).
 */
export function courseEvaluationCoursePredicate(courseId: number, courseCode: string) {
  const prefix = `${normalizeCatalogCourseCode(courseCode)}%`
  return sql`
    (
      s.course_id = ${courseId}
      OR sess.course_id = ${courseId}
      OR TRIM(UPPER(REPLACE(COALESCE(s.section, ''), ' ', ''))) LIKE ${prefix}
      OR TRIM(UPPER(REPLACE(COALESCE(ce.session, ''), ' ', ''))) LIKE ${prefix}
    )
  `
}

export function evaluationTextBelongsToCourse(
  section: string | null | undefined,
  session: string | null | undefined,
  courseCode: string | null | undefined,
): boolean {
  const course = normalizeCatalogCourseCode(courseCode)
  if (!course) return true
  const tokens = [section, session].map((value) => normalizeCatalogCourseCode(value)).filter(Boolean)
  if (tokens.length === 0) return true
  return tokens.some((token) => token === course || token.startsWith(course))
}
