import { sql } from "@/lib/db"
import { resolveStudentEnrollmentContext } from "@/lib/student-enrollment-context"

/** Resolve the catalog course id for studio telemetry (prefers session course over stale student.course_id). */
export async function resolveCourseIdForStudioEvent(studentDbId: number): Promise<number | null> {
  const ctx = await resolveStudentEnrollmentContext(studentDbId)
  return ctx.courseId
}

/** Backfill events that were stored before course_id was resolved from the student's session. */
export async function backfillCodebenchStudioEventCourseIds(): Promise<void> {
  await sql`
    UPDATE codebench_studio_events e
    SET course_id = COALESCE(s.course_id, sess.course_id)
    FROM students s
    LEFT JOIN sessions sess ON sess.id = s.session_id
    WHERE e.student_id = s.id
      AND e.course_id IS NULL
      AND COALESCE(s.course_id, sess.course_id) IS NOT NULL
  `
}

/**
 * SQL predicate: studio event belongs to the instructor's selected catalog course.
 * Includes legacy rows where course_id was NULL but the student enrolls on this course.
 */
export function studioEventInCourseSql(courseId: number, eventAlias = "e"): string {
  const cid = Math.trunc(Number(courseId))
  if (!Number.isFinite(cid) || cid < 1) return "(FALSE)"
  return `(
    ${eventAlias}.course_id = ${cid}
    OR (
      ${eventAlias}.course_id IS NULL
      AND EXISTS (
        SELECT 1
        FROM students s_course
        LEFT JOIN sessions sess_course ON sess_course.id = s_course.session_id
        WHERE s_course.id = ${eventAlias}.student_id
          AND s_course.deleted_at IS NULL
          AND COALESCE(s_course.course_id, sess_course.course_id) = ${cid}
      )
    )
  )`
}
