import { getSQL } from "@/lib/db"
import { resolveStudentCourseContextByDbId } from "@/lib/student-course-scope"

export class ClassroomAwardInstructorError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ClassroomAwardInstructorError"
  }
}

function asInstructorId(value: unknown): number | null {
  const id = Number(value)
  return Number.isFinite(id) && id > 0 ? id : null
}

/**
 * Classroom awards belong to the student's course instructor — never
 * `SELECT id FROM instructors LIMIT 1`, which attributes work to whoever
 * was inserted first (e.g. Christina Hastings instead of Daniel Doe).
 *
 * Never fall back to instructor id 1 or assignment.created_by. A faculty
 * member who created a template but has no students must not appear as
 * the award instructor.
 */
export async function resolveClassroomAwardInstructorId(options: {
  studentDbId: number
  assignmentCreatedBy?: number | null
}): Promise<number> {
  const studentDbId = Number(options.studentDbId)
  if (!Number.isFinite(studentDbId) || studentDbId <= 0) {
    throw new ClassroomAwardInstructorError(
      "Cannot award classroom points without a student id.",
    )
  }

  const sql = getSQL()

  const owned = await sql`
    SELECT c.instructor_id
    FROM students s
    JOIN courses c ON c.id = s.course_id
    WHERE s.id = ${studentDbId}
      AND c.instructor_id IS NOT NULL
    LIMIT 1
  `
  let instructorId = asInstructorId(owned[0]?.instructor_id)

  if (instructorId == null) {
    const ctx = await resolveStudentCourseContextByDbId(studentDbId)
    if (ctx?.courseId) {
      const rows = await sql`
        SELECT instructor_id FROM courses WHERE id = ${ctx.courseId} LIMIT 1
      `
      instructorId = asInstructorId(rows[0]?.instructor_id)
    }
  }

  if (instructorId == null) {
    const viaSession = await sql`
      SELECT c.instructor_id
      FROM students s
      JOIN sessions sess ON sess.id = s.session_id
      JOIN courses c ON c.id = sess.course_id
      WHERE s.id = ${studentDbId}
        AND c.instructor_id IS NOT NULL
      LIMIT 1
    `
    instructorId = asInstructorId(viaSession[0]?.instructor_id)
  }

  if (instructorId == null) {
    throw new ClassroomAwardInstructorError(
      `Cannot award classroom points: student ${studentDbId} has no course instructor.`,
    )
  }

  return instructorId
}
