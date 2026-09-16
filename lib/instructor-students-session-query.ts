import { sql } from "@/lib/db"
import { normalizedSectionVariantsForSql } from "@/lib/session-code-aliases"

const STUDENT_COLUMNS = `
  s.id,
  s.student_id,
  s.full_name,
  s.email,
  s.section,
  COALESCE(s.created_at, CURRENT_TIMESTAMP) as created_at,
  sess.code as session_code,
  sess.description as session_description,
  COALESCE(qa_counts.cnt, 0)::int as quiz_attempts
`

const QA_COUNTS_JOIN = `
  LEFT JOIN (
    SELECT student_id, COUNT(*)::int as cnt
    FROM quiz_attempts
    GROUP BY student_id
  ) qa_counts ON qa_counts.student_id = s.id
`

function parseTermId(academicTermId: number | null): number | null {
  return academicTermId != null && Number.isFinite(academicTermId) && academicTermId > 0
    ? Math.trunc(academicTermId)
    : null
}

/** Instructor roster for one section code, scoped to course + optional academic term. */
export async function fetchInstructorStudentsBySessionCode(
  platformCourseId: number,
  sessionCode: string,
  academicTermId: number | null,
) {
  const variants = normalizedSectionVariantsForSql(sessionCode)
  if (!variants.length) return []

  const cid = Math.trunc(Number(platformCourseId))
  const tid = parseTermId(academicTermId)

  if (tid != null) {
    return sql`
      SELECT ${sql.unsafe(STUDENT_COLUMNS)}
      FROM students s
      JOIN sessions sess ON sess.id = s.session_id
      ${sql.unsafe(QA_COUNTS_JOIN)}
      WHERE TRIM(sess.code) = ANY(${variants})
        AND sess.course_id = ${cid}
        AND sess.academic_term_id = ${tid}
      ORDER BY s.full_name
    `
  }

  return sql`
    SELECT ${sql.unsafe(STUDENT_COLUMNS)}
    FROM students s
    JOIN sessions sess ON sess.id = s.session_id
    ${sql.unsafe(QA_COUNTS_JOIN)}
    WHERE TRIM(sess.code) = ANY(${variants})
      AND sess.course_id = ${cid}
      AND (
        sess.academic_term_id IS NULL
        OR EXISTS (
          SELECT 1 FROM academic_terms at
          WHERE at.id = sess.academic_term_id
            AND COALESCE(at.is_active, false) = true
        )
      )
    ORDER BY s.full_name
  `
}

/** Instructor roster for one section + quiz attempt filter. */
export async function fetchInstructorStudentsBySessionCodeAndQuiz(
  platformCourseId: number,
  sessionCode: string,
  academicTermId: number | null,
  quizParam: number | string,
) {
  const variants = normalizedSectionVariantsForSql(sessionCode)
  if (!variants.length) return []

  const cid = Math.trunc(Number(platformCourseId))
  const tid = parseTermId(academicTermId)

  if (tid != null) {
    return sql`
      SELECT DISTINCT
        s.id,
        s.student_id,
        s.full_name,
        s.email,
        s.section,
        COALESCE(s.created_at, CURRENT_TIMESTAMP) as created_at,
        sess.code as session_code,
        sess.description as session_description,
        (SELECT COUNT(*)::int FROM quiz_attempts qa2 WHERE qa2.student_id = s.id) as quiz_attempts
      FROM students s
      JOIN sessions sess ON sess.id = s.session_id
      JOIN quiz_attempts qa ON qa.student_id = s.id
      WHERE TRIM(sess.code) = ANY(${variants})
        AND qa.quiz_id = ${quizParam}
        AND sess.course_id = ${cid}
        AND sess.academic_term_id = ${tid}
      ORDER BY s.full_name
    `
  }

  return sql`
    SELECT DISTINCT
      s.id,
      s.student_id,
      s.full_name,
      s.email,
      s.section,
      COALESCE(s.created_at, CURRENT_TIMESTAMP) as created_at,
      sess.code as session_code,
      sess.description as session_description,
      (SELECT COUNT(*)::int FROM quiz_attempts qa2 WHERE qa2.student_id = s.id) as quiz_attempts
    FROM students s
    JOIN sessions sess ON sess.id = s.session_id
    JOIN quiz_attempts qa ON qa.student_id = s.id
    WHERE TRIM(sess.code) = ANY(${variants})
      AND qa.quiz_id = ${quizParam}
      AND sess.course_id = ${cid}
      AND (
        sess.academic_term_id IS NULL
        OR EXISTS (
          SELECT 1 FROM academic_terms at
          WHERE at.id = sess.academic_term_id
            AND COALESCE(at.is_active, false) = true
        )
      )
    ORDER BY s.full_name
  `
}

/** Roster for a known sessions.id (from x-session-id header). */
export async function fetchInstructorStudentsBySessionId(
  platformCourseId: number,
  sessionDbId: number,
) {
  const sid = Math.trunc(Number(sessionDbId))
  const cid = Math.trunc(Number(platformCourseId))
  if (!Number.isFinite(sid) || sid < 1 || !Number.isFinite(cid) || cid < 1) return []

  return sql`
    SELECT ${sql.unsafe(STUDENT_COLUMNS)}
    FROM students s
    JOIN sessions sess ON sess.id = s.session_id
    ${sql.unsafe(QA_COUNTS_JOIN)}
    WHERE sess.id = ${sid}
      AND sess.course_id = ${cid}
    ORDER BY s.full_name
  `
}
