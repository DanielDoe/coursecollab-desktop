import { sql } from "@/lib/db"
import { CLASSROOM_SUBMISSION_KIND_CODE } from "@/lib/classroom-solution-submission"
import { sqlSubmissionEnrollmentSessionFilter, studentMatchesLiveAssignmentSession } from "@/lib/classroom-submission-scope"
import { extractClassroomQuestionText, type ClassroomAssignmentRow } from "@/lib/codebench-instructor-classroom"
import { ensureCodebenchLiveSessionsSchema } from "@/lib/codebench-live-session-schema"
import type { OpenLiveClassroomSession, StudentLiveClassroomSession } from "@/lib/codebench-live-classroom-types"

type LiveSessionRow = {
  id: number
  assignment_id: number
  course_id: number
  instructor_id: number
  started_at: string
  title: string
  description: string | null
  session: string | null
  submission_kind: string | null
  question_config: unknown
}

function toOpenSession(row: LiveSessionRow): OpenLiveClassroomSession {
  const assignment = {
    id: Number(row.assignment_id),
    title: String(row.title ?? "Live coding"),
    description: row.description,
    created_at: row.started_at,
    session: row.session,
    submission_kind: row.submission_kind ?? CLASSROOM_SUBMISSION_KIND_CODE,
    question_config: row.question_config,
    due_at: null,
    expires_at: null,
    is_active: true,
  } satisfies ClassroomAssignmentRow

  return {
    sessionId: Number(row.id),
    assignmentId: Number(row.assignment_id),
    courseId: Number(row.course_id),
    title: assignment.title,
    questionText: extractClassroomQuestionText(assignment),
    session: row.session,
    startedAt: row.started_at,
  }
}

export async function getOpenLiveClassroomSession(
  assignmentId: number,
): Promise<OpenLiveClassroomSession | null> {
  await ensureCodebenchLiveSessionsSchema()
  const rows = await sql`
    SELECT
      ls.id,
      ls.assignment_id,
      ls.course_id,
      ls.instructor_id,
      ls.started_at,
      cps.title,
      cps.description,
      cps.session,
      cps.submission_kind,
      cps.question_config
    FROM codebench_live_sessions ls
    JOIN classroom_point_submissions cps ON cps.id = ls.assignment_id
    WHERE ls.assignment_id = ${assignmentId}
      AND ls.ended_at IS NULL
    LIMIT 1
  `.catch(() => [])
  return rows.length ? toOpenSession(rows[0] as LiveSessionRow) : null
}

export async function listOpenLiveClassroomSessions(
  courseId: number,
  enrollmentScope?: {
    sessionId: number | null
    sessionCode: string | null
  },
): Promise<OpenLiveClassroomSession[]> {
  await ensureCodebenchLiveSessionsSchema()
  const sessionClause =
    enrollmentScope != null
      ? sqlSubmissionEnrollmentSessionFilter({
          courseId,
          sessionId: enrollmentScope.sessionId,
          sessionCode: enrollmentScope.sessionCode,
        })
      : sql``
  const rows = await sql`
    SELECT
      ls.id,
      ls.assignment_id,
      ls.course_id,
      ls.instructor_id,
      ls.started_at,
      cps.title,
      cps.description,
      cps.session,
      cps.submission_kind,
      cps.question_config
    FROM codebench_live_sessions ls
    JOIN classroom_point_submissions cps ON cps.id = ls.assignment_id
    WHERE ls.ended_at IS NULL
      AND ls.course_id = ${courseId}
      ${sessionClause}
    ORDER BY ls.started_at DESC
  `
  return (rows as LiveSessionRow[]).map(toOpenSession)
}

export async function listStudentOpenLiveSessions(input: {
  courseId: number
  sessionId: number | null
  sessionCode: string | null
}): Promise<StudentLiveClassroomSession[]> {
  let enrolledSession = input.sessionCode?.trim() || ""
  if (!enrolledSession && input.sessionId != null) {
    const rows = await sql`
      SELECT code FROM sessions WHERE id = ${input.sessionId} LIMIT 1
    `.catch(() => [])
    enrolledSession = String((rows[0] as { code?: string } | undefined)?.code ?? "").trim()
  }
  if (input.sessionId == null && !enrolledSession) {
    return []
  }

  // List every open session in the course, then apply alias-aware matching in JS.
  // The SQL enrollment filter is exact-code only and previously hid live classrooms
  // after section renames (E1304P01 vs ELEG1304P01) or blank "open to all" sessions.
  const sessions = await listOpenLiveClassroomSessions(input.courseId)
  return sessions
    .filter((session) => studentMatchesLiveAssignmentSession(session.session, enrolledSession, enrolledSession))
    .map(({ sessionId, assignmentId, title, questionText, session, startedAt }) => ({
      sessionId,
      assignmentId,
      title,
      questionText,
      session,
      startedAt,
    }))
}

export async function startLiveClassroomSession(input: {
  assignmentId: number
  courseId: number
  instructorId: number
}): Promise<OpenLiveClassroomSession> {
  await ensureCodebenchLiveSessionsSchema()

  const existing = await getOpenLiveClassroomSession(input.assignmentId)
  if (existing) return existing

  try {
    await sql`
      INSERT INTO codebench_live_sessions (assignment_id, course_id, instructor_id)
      VALUES (${input.assignmentId}, ${input.courseId}, ${input.instructorId})
    `
  } catch {
    const raced = await getOpenLiveClassroomSession(input.assignmentId)
    if (raced) return raced
    throw new Error("Could not start live classroom session.")
  }

  const started = await getOpenLiveClassroomSession(input.assignmentId)
  if (!started) throw new Error("Could not start live classroom session.")
  return started
}

export async function endLiveClassroomSession(input: {
  assignmentId: number
  courseId: number
}): Promise<boolean> {
  await ensureCodebenchLiveSessionsSchema()
  const rows = await sql`
    UPDATE codebench_live_sessions
    SET ended_at = NOW()
    WHERE assignment_id = ${input.assignmentId}
      AND course_id = ${input.courseId}
      AND ended_at IS NULL
    RETURNING id
  `
  return rows.length > 0
}
