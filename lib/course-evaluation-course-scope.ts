import { sql } from "@/lib/db"
import { normalizeCatalogCourseCode } from "@/lib/course-section-model"

/** Join student catalog session so evaluations can be scoped by `sessions.course_id`. */
export const COURSE_EVALUATION_SESSION_JOIN = sql.unsafe(`
  LEFT JOIN sessions sess ON sess.id = s.session_id
`)

/**
 * ECE2202UH (and other ECE2202* shells) share the live ECE2202 evaluation roster.
 * Using the full demo code as a LIKE prefix hides every historical row tagged ECE2202.
 */
export function evaluationCatalogFamilyPrefix(courseCode: string | null | undefined): string {
  const key = normalizeCatalogCourseCode(courseCode).replace(/[^A-Z0-9]/g, "")
  if (key.startsWith("ECE2202")) return "ECE2202"
  return key
}

function courseEvaluationCoursePredicateSql(courseId: number, courseCode: string): string {
  const cid = Number(courseId)
  const family = evaluationCatalogFamilyPrefix(courseCode).replace(/'/g, "''")
  // ECE2202UH / ECE2202 share one catalog family. Never LIKE section/session codes —
  // ELEG1301P01 is reused across Spring and Fall.
  if (family.startsWith("ECE2202")) {
    return `(
      s.course_id = ${cid}
      OR sess.course_id = ${cid}
      OR s.course_id IN (
        SELECT c2.id FROM courses c2
        WHERE TRIM(UPPER(REPLACE(COALESCE(c2.course_code, ''), ' ', ''))) LIKE 'ECE2202%'
      )
      OR sess.course_id IN (
        SELECT c2.id FROM courses c2
        WHERE TRIM(UPPER(REPLACE(COALESCE(c2.course_code, ''), ' ', ''))) LIKE 'ECE2202%'
      )
    )`
  }
  return `(
      s.course_id = ${cid}
      OR sess.course_id = ${cid}
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
  const course = evaluationCatalogFamilyPrefix(courseCode)
  if (!course) return true
  const tokens = [section, session].map((value) => evaluationCatalogFamilyPrefix(value)).filter(Boolean)
  if (tokens.length === 0) return true
  return tokens.some((token) => token === course || token.startsWith(course) || course.startsWith(token))
}
