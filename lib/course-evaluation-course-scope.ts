import { sql } from "@/lib/db"
import { normalizeCatalogCourseCode } from "@/lib/course-section-model"

/** Join student catalog session so evaluations can be scoped by `sessions.course_id`. */
export const COURSE_EVALUATION_SESSION_JOIN = sql.unsafe(`
  LEFT JOIN sessions sess ON sess.id = s.session_id
`)

function courseEvaluationCoursePredicateSql(courseId: number, courseCode: string): string {
  const cid = Number(courseId)
  const prefix = `${normalizeCatalogCourseCode(courseCode).replace(/'/g, "''")}%`
  return `(
      s.course_id = ${cid}
      OR sess.course_id = ${cid}
      OR TRIM(UPPER(REPLACE(COALESCE(s.section, ''), ' ', ''))) LIKE '${prefix}'
      OR TRIM(UPPER(REPLACE(COALESCE(ce.session, ''), ' ', ''))) LIKE '${prefix}'
    )`
}

/** sql.unsafe AND clause for course-scoped evaluation queries (embed inside sql.unsafe queries). */
export function courseEvaluationCourseAndClause(
  courseId: number | null | undefined,
  courseCode: string | null | undefined,
) {
  if (courseId == null || !String(courseCode ?? "").trim()) return sql.unsafe("")
  return sql.unsafe(`AND ${courseEvaluationCoursePredicateSql(courseId, courseCode)}`)
}

/**
 * Inner course-scope predicate as a sql.unsafe fragment.
 * Do not wrap with `sql`…`` — the project's sql tag is async and nested calls become Promises.
 */
export function courseEvaluationCoursePredicate(courseId: number, courseCode: string) {
  return sql.unsafe(courseEvaluationCoursePredicateSql(courseId, courseCode))
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
