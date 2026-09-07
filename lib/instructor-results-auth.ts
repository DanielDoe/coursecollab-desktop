import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import { studentInSelectedCourseSql } from "@/lib/instructor-results-course-scope"

export async function requireInstructorResults(request: NextRequest) {
  return requireInstructorCourse(request)
}

/**
 * Auth first (401), then course scope (403), then attempt must belong to that course (404).
 * Never look up an attempt before instructor authentication — avoids existence oracles.
 */
export async function requireInstructorAttemptAccess(
  request: NextRequest,
  attemptIdRaw: string | number,
): Promise<
  | { ok: true; instructorId: number; courseId: number; attemptId: number; studentId: number }
  | { ok: false; response: NextResponse }
> {
  const scope = await requireInstructorCourse(request)
  if (!scope.ok) return scope

  const attemptId = Number(attemptIdRaw)
  if (!Number.isFinite(attemptId) || attemptId <= 0) {
    return { ok: false, response: NextResponse.json({ error: "Invalid attempt id" }, { status: 400 }) }
  }

  // Match /api/[assessmentType]/results list scope: student in selected catalog course.
  // Do not narrow by academic term from the course picker — Spring/Fall rosters share
  // ELEG1301/ECE2202 catalog rows; term headers hid historical attempts in Manage Results.
  const studentPred = studentInSelectedCourseSql(scope.course.id, scope.course.course_code)
  const rows = await sql`
    SELECT qa.id, qa.student_id
    FROM quiz_attempts qa
    INNER JOIN quizzes q ON q.id = qa.quiz_id AND q.deleted_at IS NULL
    INNER JOIN students s ON s.id = qa.student_id AND (s.deleted_at IS NULL)
    WHERE qa.id = ${attemptId}
      AND qa.deleted_at IS NULL
      AND ${sql.unsafe(studentPred)}
    LIMIT 1
  `
  if (rows.length === 0) {
    return { ok: false, response: NextResponse.json({ error: "Attempt not found" }, { status: 404 }) }
  }

  const row = rows[0] as { student_id: number }

  return {
    ok: true,
    instructorId: scope.instructorId,
    courseId: scope.course.id,
    attemptId,
    studentId: Number(row.student_id),
  }
}
