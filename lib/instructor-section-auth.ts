import { sql } from "@/lib/db"

/**
 * Academic `sessions` rows are not tied to an instructor. Authorize section access if the
 * instructor has active assessment access for a matching session code, course staff on the
 * offering, or runs attendance for that section string.
 */
export async function instructorOwnsSectionVariants(
  instructorId: number,
  variants: string[],
  courseId?: number | null,
): Promise<boolean> {
  if (!Number.isFinite(instructorId) || instructorId <= 0 || variants.length === 0) {
    return false
  }

  if (courseId != null && Number.isFinite(courseId)) {
    const byCourseStaff = await sql`
      SELECT 1
      FROM course_staff cs
      INNER JOIN sessions sess ON sess.course_id = cs.course_id
      WHERE cs.instructor_id = ${instructorId}
        AND cs.is_active = true
        AND cs.course_id = ${courseId}
        AND TRIM(sess.code) = ANY(${variants}::text[])
      LIMIT 1
    `
    if (byCourseStaff.length > 0) return true
  }

  const byQuiz = await sql`
    SELECT 1
    FROM quizzes q
    INNER JOIN quiz_session_access qsa ON qsa.quiz_id = q.id AND qsa.is_active = true
    INNER JOIN sessions sess ON sess.id = qsa.session_id
    WHERE q.deleted_at IS NULL
      AND q.created_by = ${instructorId}
      AND TRIM(sess.code) = ANY(${variants}::text[])
    LIMIT 1
  `
  if (byQuiz.length > 0) return true

  const byAttendance = await sql`
    SELECT 1
    FROM attendance_sessions asess
    WHERE asess.instructor_id = ${instructorId}
      AND TRIM(asess.section) = ANY(${variants}::text[])
    LIMIT 1
  `
  return byAttendance.length > 0
}
