import { type NextRequest } from "next/server"
import { sql } from "@/lib/db"
import { getOpenLiveClassroomSession } from "@/lib/codebench-live-classroom"
import { classroomAssignmentSessionMatchesStudent } from "@/lib/classroom-submission-scope"
import { ensureCodebenchLiveSnapshotsSchema } from "@/lib/codebench-live-session-schema"
import {
  readInstructorSessionScopeFromRequest,
  studentInInstructorSessionScopeSql,
} from "@/lib/instructor-session-scope"

export const LIVE_PUSH_MAX_CODE_CHARS = 80_000

export type LiveInstructorPush = {
  revision: number
  code: string
  language: string | null
  fileName: string | null
  pushedAt: string | null
}

export async function readStudentLiveInstructorPush(
  studentDbId: number,
  assignmentId: number,
): Promise<LiveInstructorPush> {
  await ensureCodebenchLiveSnapshotsSchema()
  const rows = await sql`
    SELECT instructor_code, instructor_revision, instructor_updated_at, language, file_name
    FROM codebench_live_snapshots
    WHERE student_id = ${studentDbId}
      AND assignment_id = ${assignmentId}
    LIMIT 1
  `.catch(() => [])

  const row = rows[0] as
    | {
        instructor_code?: string | null
        instructor_revision?: number | null
        instructor_updated_at?: string | null
        language?: string | null
        file_name?: string | null
      }
    | undefined

  return {
    revision: Number(row?.instructor_revision) || 0,
    code: typeof row?.instructor_code === "string" ? row.instructor_code : "",
    language: row?.language ?? null,
    fileName: row?.file_name ?? null,
    pushedAt: row?.instructor_updated_at ?? null,
  }
}

export async function pushInstructorLiveCode(input: {
  request: NextRequest
  courseId: number
  assignmentId: number
  studentDbId: number
  code: string
  language?: string | null
  fileName?: string | null
}): Promise<
  | { ok: true; revision: number }
  | { ok: false; status: number; error: string }
> {
  const liveSession = await getOpenLiveClassroomSession(input.assignmentId)
  if (!liveSession || liveSession.courseId !== input.courseId) {
    return { ok: false, status: 409, error: "No live classroom session is open for this assignment." }
  }

  const assignmentRows = await sql`
    SELECT session
    FROM classroom_point_submissions
    WHERE id = ${input.assignmentId}
    LIMIT 1
  `
  if (assignmentRows.length === 0) {
    return { ok: false, status: 404, error: "Assignment not found." }
  }
  const assignmentSession = (assignmentRows[0] as { session?: string | null }).session?.trim() || null

  const scope = readInstructorSessionScopeFromRequest(input.request)
  const scopeWhere = studentInInstructorSessionScopeSql({
    courseId: input.courseId,
    sessionId: scope.sessionId,
    academicTermId: scope.academicTermId,
  })
  const studentRows = await sql`
    SELECT s.id, sess.code AS session_code
    FROM students s
    JOIN sessions sess ON sess.id = s.session_id
    WHERE s.id = ${input.studentDbId}
      AND s.deleted_at IS NULL
      AND ${sql.unsafe(scopeWhere)}
    LIMIT 1
  `.catch(() => [])

  const student = studentRows[0] as { id: number; session_code?: string | null } | undefined
  if (!student) {
    return { ok: false, status: 404, error: "Student not found in this live classroom." }
  }
  if (!classroomAssignmentSessionMatchesStudent(assignmentSession, student.session_code ?? null)) {
    return { ok: false, status: 403, error: "This student is not in the assignment section." }
  }

  const code = input.code.slice(0, LIVE_PUSH_MAX_CODE_CHARS)
  const language = input.language?.trim().slice(0, 32) || null
  const fileName = input.fileName?.trim().slice(0, 80) || null

  await ensureCodebenchLiveSnapshotsSchema()

  // Only write instructor_code on conflict so faculty keep seeing the student stream.
  const updated = await sql`
    INSERT INTO codebench_live_snapshots (
      student_id,
      assignment_id,
      course_id,
      language,
      file_name,
      code,
      instructor_code,
      instructor_revision,
      instructor_updated_at,
      updated_at
    ) VALUES (
      ${input.studentDbId},
      ${input.assignmentId},
      ${input.courseId},
      ${language},
      ${fileName},
      ${code},
      ${code},
      1,
      NOW(),
      NOW()
    )
    ON CONFLICT (student_id, assignment_id)
    DO UPDATE SET
      course_id = COALESCE(EXCLUDED.course_id, codebench_live_snapshots.course_id),
      language = COALESCE(EXCLUDED.language, codebench_live_snapshots.language),
      file_name = COALESCE(EXCLUDED.file_name, codebench_live_snapshots.file_name),
      instructor_code = EXCLUDED.instructor_code,
      instructor_revision = COALESCE(codebench_live_snapshots.instructor_revision, 0) + 1,
      instructor_updated_at = NOW()
    RETURNING instructor_revision
  `

  const revision = Number((updated[0] as { instructor_revision?: number } | undefined)?.instructor_revision) || 1
  return { ok: true, revision }
}
