import { sql } from "@/lib/db"
import { CLASSROOM_SUBMISSION_IS_ACTIVE_SQL } from "@/lib/classroom-submission-availability-sql"
import {
  classroomAssignmentSessionMatchesStudent,
  submissionBelongsToCourse,
} from "@/lib/classroom-submission-scope"
import { getOpenLiveClassroomSession } from "@/lib/codebench-live-classroom"
import { resolveStudentCourseContextByDbId } from "@/lib/student-course-scope"

export type LiveSnapshotAssignment = {
  id: number
  title: string
  session: string | null
  created_at: string
}

export async function validateStudentLiveSnapshotAccess(
  studentDbId: number,
  assignmentId: number,
): Promise<
  | { ok: true; assignment: LiveSnapshotAssignment; courseId: number | null }
  | { ok: false; status: number; error: string }
> {
  try {
    await sql`ALTER TABLE classroom_point_submissions ADD COLUMN IF NOT EXISTS hidden_from_students BOOLEAN NOT NULL DEFAULT false`
  } catch {
    /* column may already exist or migration unavailable */
  }

  const rows = await sql`
    SELECT
      id,
      title,
      session,
      created_at,
      COALESCE(hidden_from_students, false) AS hidden_from_students,
      (${sql.unsafe(CLASSROOM_SUBMISSION_IS_ACTIVE_SQL)}) AS is_active
    FROM classroom_point_submissions
    WHERE id = ${assignmentId}
    LIMIT 1
  `.catch(() => [])

  if (rows.length === 0) {
    return { ok: false, status: 404, error: "Assignment not found." }
  }

  const assignment = rows[0] as LiveSnapshotAssignment & {
    hidden_from_students: boolean
    is_active: boolean
  }

  if (assignment.hidden_from_students) {
    return { ok: false, status: 404, error: "Assignment not found." }
  }

  const liveSession = await getOpenLiveClassroomSession(assignmentId)
  if (!liveSession) {
    return { ok: false, status: 410, error: "No live session is open for this assignment." }
  }

  const ctx = await resolveStudentCourseContextByDbId(studentDbId)
  const enrolledSession = ctx?.sessionCode?.trim() || null
  if (!classroomAssignmentSessionMatchesStudent(assignment.session, enrolledSession)) {
    return { ok: false, status: 403, error: "This assignment is not available for your section." }
  }

  const courseId = ctx?.courseId ?? null
  if (courseId != null) {
    const inCourse = await submissionBelongsToCourse(assignmentId, courseId)
    if (!inCourse) {
      return { ok: false, status: 403, error: "This assignment is not available for your course." }
    }
  }

  return {
    ok: true,
    assignment: {
      id: assignment.id,
      title: assignment.title,
      session: assignment.session,
      created_at: assignment.created_at,
    },
    courseId,
  }
}
