import { sql } from "@/lib/db"
import { CLASSROOM_SUBMISSION_IS_ACTIVE_SQL } from "@/lib/classroom-submission-availability-sql"
import {
  classroomAssignmentSessionMatchesStudent,
  submissionBelongsToCourse,
} from "@/lib/classroom-submission-scope"
import { studentMatchesLiveAssignmentSession } from "@/lib/classroom-assignment-session-match"
import {
  getOpenLiveClassroomSession,
  listOpenLiveClassroomSessions,
} from "@/lib/codebench-live-classroom"
import type { StudentLiveClassroomSession } from "@/lib/codebench-live-classroom-types"
import { replacementLiveSession } from "@/lib/codebench-live-student-ui"
import { resolveStudentCourseContextForRequest } from "@/lib/student-course-scope"
import type { NextRequest } from "next/server"

export type LiveSnapshotAssignment = {
  id: number
  title: string
  session: string | null
  created_at: string
}

let hiddenColumnReady: Promise<void> | null = null

function ensureHiddenFromStudentsColumn() {
  if (!hiddenColumnReady) {
    hiddenColumnReady = sql`
      ALTER TABLE classroom_point_submissions
      ADD COLUMN IF NOT EXISTS hidden_from_students BOOLEAN NOT NULL DEFAULT false
    `
      .then(() => undefined)
      .catch((error) => {
        hiddenColumnReady = null
        throw error
      })
  }
  return hiddenColumnReady
}

export async function validateStudentLiveSnapshotAccess(
  request: NextRequest,
  studentDbId: number,
  assignmentId: number,
): Promise<
  | {
      ok: true
      assignment: LiveSnapshotAssignment
      courseId: number | null
      /** Server-clock epoch ms of the open live session's start. */
      liveSessionStartedAtMs: number | null
    }
  | { ok: false; status: number; error: string; movedTo?: StudentLiveClassroomSession | null }
> {
  try {
    await ensureHiddenFromStudentsColumn()
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

  // Hidden assignments stay off the student catalog, but an instructor can still open a
  // live classroom on one. Rejecting those snapshots as "not found" drops every keystroke.
  const liveSession = await getOpenLiveClassroomSession(assignmentId)
  if (!liveSession) {
    const movedTo = await replacementForClosedAssignment(request, studentDbId, assignmentId)
    return {
      ok: false,
      status: 410,
      error: "No live session is open for this assignment.",
      movedTo,
    }
  }

  const ctx = await resolveStudentCourseContextForRequest(request, studentDbId)

  // Live classroom section gate. A null/blank assignment session means the assignment is open
  // to every section. The comparison must be alias-aware (legacy vs canonical codes, e.g.
  // E1301P01 vs ELEG1301P01) — the instructor roster uses the same matcher, and the previous
  // strict TRIM-equality SQL check 403'd joining students who then never appeared as live.
  const assignmentSession =
    typeof assignment.session === "string" ? assignment.session.trim() : ""
  if (assignmentSession) {
    let enrolledSessionCode = ctx?.sessionCode?.trim() || null
    if (!enrolledSessionCode && ctx?.sessionId != null) {
      const sectionRows = await sql`
        SELECT code FROM sessions WHERE id = ${ctx.sessionId} LIMIT 1
      `.catch(() => [])
      const code = (sectionRows[0] as { code?: string | null } | undefined)?.code
      enrolledSessionCode = typeof code === "string" && code.trim() ? code.trim() : null
    }
    if (
      !enrolledSessionCode ||
      !classroomAssignmentSessionMatchesStudent(assignmentSession, enrolledSessionCode)
    ) {
      return { ok: false, status: 403, error: "This assignment is not available for your section." }
    }
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
    liveSessionStartedAtMs: epochMsOrNull(liveSession.startedAt),
  }
}

async function replacementForClosedAssignment(
  request: NextRequest,
  studentDbId: number,
  closedAssignmentId: number,
): Promise<StudentLiveClassroomSession | null> {
  try {
    const ctx = await resolveStudentCourseContextForRequest(request, studentDbId)
    if (!ctx?.courseId) return null
    let enrolledSession = ctx.sessionCode?.trim() || ""
    if (!enrolledSession && ctx.sessionId != null) {
      const sectionRows = await sql`
        SELECT code FROM sessions WHERE id = ${ctx.sessionId} LIMIT 1
      `.catch(() => [])
      enrolledSession = String((sectionRows[0] as { code?: string } | undefined)?.code ?? "").trim()
    }
    if (ctx.sessionId == null && !enrolledSession) return null
    const sessions = await listOpenLiveClassroomSessions(ctx.courseId)
    const matched = sessions
      .filter((session) =>
        studentMatchesLiveAssignmentSession(session.session, enrolledSession, enrolledSession),
      )
      .map(({ sessionId, assignmentId, title, questionText, session, startedAt }) => ({
        sessionId,
        assignmentId,
        title,
        questionText,
        session,
        startedAt,
      }))
    return replacementLiveSession(matched, closedAssignmentId)
  } catch {
    return null
  }
}

function epochMsOrNull(value: unknown): number | null {
  if (value == null) return null
  const ms = new Date(value as string | Date).getTime()
  return Number.isFinite(ms) ? ms : null
}
