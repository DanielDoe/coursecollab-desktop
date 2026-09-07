import { sql } from "@/lib/db"
import {
  elegSharedLectureStudentBundleSql,
  hasLectureSessionAccessTable,
  isElegSharedLectureCourseCode,
} from "@/lib/instructor-default-courses"

export type StudentLectureSessionRow = {
  id: number
  student_id: string
  section: string
  session_code: string
  session_id: number | null
  student_course_id: number | null
  session_course_id: number | null
  session_instructor_id: number | null
  session_course_code: string
}

/** Loads roster row + session/course info for a student login id (`students.student_id`). */
export async function getStudentLectureSession(studentId: string) {
  const studentSession = await sql`
    SELECT
      s.id,
      s.student_id,
      TRIM(COALESCE(s.section::text, '')) AS section,
      s.session_id,
      s.course_id AS student_course_id,
      TRIM(COALESCE(sess.code::text, '')) AS session_code,
      sess.course_id AS session_course_id,
      sess_co.instructor_id AS session_instructor_id,
      TRIM(COALESCE(sess_co.course_code::text, '')) AS session_course_code
    FROM students s
    LEFT JOIN sessions sess ON s.session_id = sess.id
    LEFT JOIN courses sess_co ON sess_co.id = sess.course_id
    WHERE s.student_id = ${studentId}
    LIMIT 1
  `
  return (studentSession[0] as StudentLectureSessionRow | undefined) ?? null
}

/** Loads roster row + session/course info for an internal `students.id`. */
export async function getStudentLectureSessionByDbId(studentDbId: number) {
  if (!Number.isFinite(studentDbId) || studentDbId <= 0) return null
  const studentSession = await sql`
    SELECT
      s.id,
      s.student_id,
      TRIM(COALESCE(s.section::text, '')) AS section,
      s.session_id,
      s.course_id AS student_course_id,
      TRIM(COALESCE(sess.code::text, '')) AS session_code,
      sess.course_id AS session_course_id,
      sess_co.instructor_id AS session_instructor_id,
      TRIM(COALESCE(sess_co.course_code::text, '')) AS session_course_code
    FROM students s
    LEFT JOIN sessions sess ON s.session_id = sess.id
    LEFT JOIN courses sess_co ON sess_co.id = sess.course_id
    WHERE s.id = ${studentDbId}
    LIMIT 1
  `
  return (studentSession[0] as StudentLectureSessionRow | undefined) ?? null
}

/** Legacy `session_access` column: match via catalog `session_id`, not stale `students.section`. */
export function legacyLectureSessionAccessSqlFragment(sessionId: number | null) {
  if (sessionId == null) {
    return sql.unsafe(`(l.session_access IS NULL)`)
  }
  const sid = Math.trunc(sessionId)
  return sql.unsafe(`(
    l.session_access IS NULL
    OR EXISTS (
      SELECT 1 FROM sessions stu_sess
      WHERE stu_sess.id = ${sid}
        AND TRIM(stu_sess.code) = ANY(l.session_access)
    )
  )`)
}

/** Course scope OR for student lecture list (own session course + ELEG shared bundle). */
export function studentLectureCourseScopeSqlFragment(
  sessCourseId: number | null,
  elegSharedForStudent: ReturnType<typeof sql.unsafe>,
) {
  return sql.unsafe(`(
    l.course_id IS NULL
    OR l.course_id IS NOT DISTINCT FROM ${sessCourseId}
    OR (${elegSharedForStudent})
  )`)
}

/** Legacy path allowed when no junction row exists yet for this session (Fall vs Spring duplicate codes). */
export function studentLectureNoSessionLsaSqlFragment(sessionId: number | null) {
  if (sessionId == null) {
    return sql.unsafe(`(TRUE)`)
  }
  const sid = Math.trunc(sessionId)
  return sql.unsafe(`NOT EXISTS (
    SELECT 1 FROM lecture_session_access lsa_student
    WHERE lsa_student.lecture_id = l.id
      AND lsa_student.session_id = ${sid}
  )`)
}

/**
 * Returns 1 row if the student may access this published lecture (same rules as /api/student/lectures).
 */
export async function isLectureAccessibleToStudent(studentId: string, lectureId: number): Promise<boolean> {
  const row = await getStudentLectureSession(studentId)
  if (!row) return false

  const sessionId = row.session_id
  const sessCourseId = row.session_course_id
  const sessionInstructorId = row.session_instructor_id
  const isBetaStudent =
    row.section.toUpperCase().includes("BETA") || row.session_code.toUpperCase().includes("BETA")

  const elegSharedForStudent =
    sessionInstructorId != null && isElegSharedLectureCourseCode(row.session_course_code)
      ? elegSharedLectureStudentBundleSql(sessionInstructorId)
      : sql.unsafe("(FALSE)")

  const legacyAccess = legacyLectureSessionAccessSqlFragment(sessionId)
  const legacyWhenNoSessionLsa = studentLectureNoSessionLsaSqlFragment(sessionId)
  const hasLsa = await hasLectureSessionAccessTable()

  const found = !hasLsa
    ? await sql`
        SELECT l.id
        FROM lectures l
        WHERE l.id = ${lectureId}
          AND l.deleted_at IS NULL
          AND COALESCE(l.is_published, true) IS NOT DISTINCT FROM TRUE
          AND (
            ${isBetaStudent}
            OR (
              (
                l.course_id IS NULL
                OR l.course_id IS NOT DISTINCT FROM ${sessCourseId}
                OR (${elegSharedForStudent})
              )
              AND (${legacyAccess})
            )
          )
        LIMIT 1
      `
    : await sql`
        SELECT l.id
        FROM lectures l
        WHERE l.id = ${lectureId}
          AND l.deleted_at IS NULL
          AND COALESCE(l.is_published, true) IS NOT DISTINCT FROM TRUE
          AND (
            ${isBetaStudent}
            OR EXISTS (
              SELECT 1 FROM lecture_session_access lsa
              WHERE lsa.lecture_id = l.id
                AND lsa.is_active = true
                AND ${sessionId} IS NOT NULL
                AND lsa.session_id = ${sessionId}
            )
            OR (
              (${legacyWhenNoSessionLsa})
              AND (
                l.course_id IS NULL
                OR l.course_id IS NOT DISTINCT FROM ${sessCourseId}
                OR (${elegSharedForStudent})
              )
              AND (${legacyAccess})
            )
          )
        LIMIT 1
      `

  return found.length > 0
}
