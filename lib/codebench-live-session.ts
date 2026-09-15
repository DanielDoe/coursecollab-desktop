import { type NextRequest } from "next/server"
import { sql } from "@/lib/db"
import { getOpenLiveClassroomSession } from "@/lib/codebench-live-classroom"
import { ensureCodebenchLiveSnapshotsSchema } from "@/lib/codebench-live-session-schema"
import { ensureCodebenchStudioEventsSchema } from "@/lib/codebench-studio-schema"
import { studioEventInCourseSql } from "@/lib/codebench-studio-course-scope"
import { formatInstructorStudioEvent } from "@/lib/codebench-instructor-student-activity"
import { studentInOfferingSqlFromRequest } from "@/lib/instructor-session-scope"
import { classroomAssignmentSessionMatchesStudent } from "@/lib/classroom-submission-scope"
import type { TypingReplay } from "@/lib/typing-replay"
import type {
  LiveClassroomSessionPayload,
  LiveClassroomStudentRow,
  LiveStudentStatus,
} from "@/lib/codebench-live-classroom-types"

export type {
  LiveClassroomSessionPayload,
  LiveClassroomStudentRow,
  LiveStudentStatus,
} from "@/lib/codebench-live-classroom-types"

async function ensureLiveSessionSchemas() {
  try {
    await ensureCodebenchLiveSnapshotsSchema()
  } catch (error) {
    console.error("[live-session] snapshots schema", error)
  }
  try {
    await ensureCodebenchStudioEventsSchema()
  } catch (error) {
    console.error("[live-session] studio schema", error)
  }
  try {
    await sql`ALTER TABLE students ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`
  } catch {
    /* column may already exist or migration unavailable */
  }
}

type ScopedStudentRow = {
  student_db_id: number
  student_id: string
  full_name: string
  section: string | null
  session_code: string | null
}

async function loadScopedStudents(courseId: number, request: NextRequest): Promise<ScopedStudentRow[]> {
  const scopeWhere = studentInOfferingSqlFromRequest(request, courseId, "s")
  try {
    const rows = await sql`
      SELECT
        s.id AS student_db_id,
        s.student_id,
        s.full_name,
        COALESCE(NULLIF(TRIM(s.section), ''), NULLIF(TRIM(sess.code), '')) AS section,
        sess.code AS session_code
      FROM students s
      LEFT JOIN sessions sess ON sess.id = s.session_id
      WHERE ${sql.unsafe(scopeWhere)}
        AND s.deleted_at IS NULL
      ORDER BY s.full_name ASC
    `
    return rows as ScopedStudentRow[]
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (!message.includes("deleted_at")) throw error
    const rows = await sql`
      SELECT
        s.id AS student_db_id,
        s.student_id,
        s.full_name,
        COALESCE(NULLIF(TRIM(s.section), ''), NULLIF(TRIM(sess.code), '')) AS section,
        sess.code AS session_code
      FROM students s
      LEFT JOIN sessions sess ON sess.id = s.session_id
      WHERE ${sql.unsafe(scopeWhere)}
      ORDER BY s.full_name ASC
    `
    return rows as ScopedStudentRow[]
  }
}

function statusLabel(status: LiveStudentStatus): string {
  switch (status) {
    case "not_started":
      return "Not started"
    case "coding":
      return "Coding now"
    case "error":
      return "Compile error"
    case "needs_help":
      return "Needs help"
    case "submitted":
      return "Submitted"
    case "approved":
      return "Correct / approved"
    case "review":
      return "Awaiting review"
    default:
      return "Unknown"
  }
}

const LIVE_ACTIVITY_MS = 3 * 60 * 1000

function isActiveRecently(input: {
  lastActivityMs: number | null
  snapshotAgeMs: number | null
}): boolean {
  return (
    (input.lastActivityMs != null && input.lastActivityMs < LIVE_ACTIVITY_MS) ||
    (input.snapshotAgeMs != null && input.snapshotAgeMs < LIVE_ACTIVITY_MS)
  )
}

function deriveStatus(input: {
  classroomStatus: string | null
  hasSubmission: boolean
  lastActivityMs: number | null
  latestEventType: string | null
  latestCoraTool: string | null
  compileErrors: number
  snapshotAgeMs: number | null
}): LiveStudentStatus {
  const status = String(input.classroomStatus ?? "").toLowerCase()
  const activeRecently = isActiveRecently(input)

  if (activeRecently) {
    if (input.latestEventType === "compile_error") return "error"
    if (input.latestEventType === "suggest_fix") return "needs_help"
    if (input.latestEventType === "cora_tool" && input.latestCoraTool === "debug") return "needs_help"
    if (input.compileErrors > 0 && input.latestEventType !== "compile_success") return "error"
    return "coding"
  }

  if (status === "approved") return "approved"
  if (status === "rejected" || status === "needs_review") return "review"
  if (input.hasSubmission || status === "pending") return "submitted"
  return "not_started"
}

function parseTypingReplay(raw: unknown): TypingReplay | null {
  if (!raw || typeof raw !== "object") return null
  const replay = raw as TypingReplay
  if (!Array.isArray(replay.events) || replay.events.length === 0) return null
  return replay
}

function parseLiveEditorCursor(raw: unknown): LiveClassroomStudentRow["studentCursor"] {
  if (raw == null) return undefined
  if (typeof raw === "string") {
    try {
      return parseLiveEditorCursor(JSON.parse(raw))
    } catch {
      return undefined
    }
  }
  if (typeof raw !== "object") return undefined
  const o = raw as { line?: unknown; column?: unknown; lineNumber?: unknown }
  const line = Number(o.line ?? o.lineNumber)
  const column = Number(o.column ?? 1)
  if (!Number.isFinite(line) || line < 1) return undefined
  return {
    line: Math.trunc(line),
    column: Number.isFinite(column) && column > 0 ? Math.trunc(column) : 1,
  }
}

function firstNonEmptyCode(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value
  }
  return null
}

type ClassroomPointLiveRow = {
  student_id: number
  status: string
  points: number | null
  created_at: string
  code?: string | null
}

function pickPreferredClassroomRow(
  current: ClassroomPointLiveRow | undefined,
  next: ClassroomPointLiveRow,
): ClassroomPointLiveRow {
  if (!current) return next
  const currentHasCode = Boolean(firstNonEmptyCode(current.code))
  const nextHasCode = Boolean(firstNonEmptyCode(next.code))
  if (nextHasCode !== currentHasCode) return nextHasCode ? next : current
  const currentApproved = String(current.status ?? "").toLowerCase() === "approved"
  const nextApproved = String(next.status ?? "").toLowerCase() === "approved"
  if (nextApproved !== currentApproved) return nextApproved ? next : current
  return new Date(next.created_at).getTime() >= new Date(current.created_at).getTime() ? next : current
}

export async function fetchLiveClassroomSession(
  courseId: number,
  assignmentId: number,
  request: NextRequest,
): Promise<LiveClassroomSessionPayload | null> {
  await ensureLiveSessionSchemas()
  let openSession: Awaited<ReturnType<typeof getOpenLiveClassroomSession>> = null
  try {
    openSession = await getOpenLiveClassroomSession(assignmentId)
  } catch (error) {
    console.error("[live-session] open session lookup", error)
  }

  const assignmentRows = await sql`
    SELECT id, title, session, created_at
    FROM classroom_point_submissions
    WHERE id = ${assignmentId}
    LIMIT 1
  `
  if (assignmentRows.length === 0) return null

  const assignment = assignmentRows[0] as {
    id: number
    title: string
    session: string | null
    created_at: string
  }

  const scopeWhere = studentInOfferingSqlFromRequest(request, courseId, "s")
  const eventCourseMatch = studioEventInCourseSql(courseId, "e")
  const assignmentSession = assignment.session?.trim() || null

  let studentRows: ScopedStudentRow[] = []
  try {
    studentRows = await loadScopedStudents(courseId, request)
  } catch (error) {
    console.error("[live-session] scoped students", error)
  }

  const [snapshotRows, submissionRows, classroomPointRows, recentEvents] = await Promise.all([
    sql`
      SELECT
        student_id,
        code,
        instructor_code,
        instructor_updated_at,
        file_name,
        language,
        typing_replay,
        updated_at,
        student_cursor,
        instructor_cursor
      FROM codebench_live_snapshots
      WHERE assignment_id = ${assignmentId}
    `.catch(() => []),
    sql`
      SELECT cs.student_id, cs.code, cs.status, cs.score, cs.submitted_at
      FROM classroom_points cp
      INNER JOIN codebench_submissions cs ON cs.classroom_point_id = cp.id
      WHERE cp.submission_id = ${assignmentId}
    `.catch(() =>
      sql`
        SELECT student_id, code, status, score, submitted_at
        FROM codebench_submissions
        WHERE assignment_id = ${assignmentId}
      `.catch(() => []),
    ),
    sql`
      SELECT
        cp.student_id,
        cp.status,
        cp.points,
        cp.created_at,
        cs.code
      FROM classroom_points cp
      LEFT JOIN codebench_submissions cs ON cs.classroom_point_id = cp.id
      WHERE cp.submission_id = ${assignmentId}
    `.catch(
      () =>
        sql`
          SELECT student_id, status, points, created_at
          FROM classroom_points
          WHERE submission_id = ${assignmentId}
        `.catch(() => []),
    ),
    sql`
      SELECT
        e.id,
        e.student_id AS student_db_id,
        s.full_name,
        e.event_type,
        e.tool,
        e.file_name,
        e.error_family,
        e.error_message,
        e.created_at
      FROM codebench_studio_events e
      JOIN students s ON s.id = e.student_id
      WHERE ${sql.unsafe(eventCourseMatch)}
        AND e.created_at >= ${assignment.created_at}::timestamptz
        AND ${sql.unsafe(scopeWhere)}
      ORDER BY e.created_at DESC
      LIMIT 60
    `.catch(() => []),
  ])

  const filteredStudents = studentRows.filter((row) =>
    classroomAssignmentSessionMatchesStudent(assignmentSession, row.session_code),
  )

  const snapshotByStudent = new Map<number, (typeof snapshotRows)[number]>()
  for (const row of snapshotRows as Array<{
    student_id: number
    code: string
    instructor_code?: string | null
    instructor_updated_at?: string | null
    file_name: string | null
    language: string | null
    typing_replay: unknown
    updated_at: string
    student_cursor?: unknown
    instructor_cursor?: unknown
  }>) {
    snapshotByStudent.set(Number(row.student_id), row)
  }

  const submissionByStudent = new Map<number, (typeof submissionRows)[number]>()
  for (const row of submissionRows as Array<{
    student_id: number
    code: string
    status: string | null
    score: number | null
    submitted_at: string
  }>) {
    const studentDbId = Number(row.student_id)
    const existing = submissionByStudent.get(studentDbId)
    if (!existing || (firstNonEmptyCode(row.code) && !firstNonEmptyCode(existing.code))) {
      submissionByStudent.set(studentDbId, row)
    }
  }

  const classroomByStudent = new Map<number, ClassroomPointLiveRow>()
  for (const row of classroomPointRows as ClassroomPointLiveRow[]) {
    const studentDbId = Number(row.student_id)
    classroomByStudent.set(studentDbId, pickPreferredClassroomRow(classroomByStudent.get(studentDbId), row))
  }

  type StudioEventRow = {
    id: number
    student_db_id: number
    full_name: string
    event_type: string
    tool: string | null
    file_name: string | null
    error_family: string | null
    error_message: string | null
    created_at: string
  }

  const eventsByStudent = new Map<number, StudioEventRow[]>()
  for (const row of recentEvents as StudioEventRow[]) {
    const list = eventsByStudent.get(row.student_db_id) ?? []
    list.push(row)
    eventsByStudent.set(row.student_db_id, list)
  }
  for (const [studentDbId, list] of eventsByStudent) {
    list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    eventsByStudent.set(studentDbId, list)
  }

  const now = Date.now()

  const students: LiveClassroomStudentRow[] = filteredStudents.map((row) => {
    const snapshot = snapshotByStudent.get(row.student_db_id)
    const submission = submissionByStudent.get(row.student_db_id)
    const classroom = classroomByStudent.get(row.student_db_id)
    const events = eventsByStudent.get(row.student_db_id) ?? []

    const compileErrors = events.filter((e) => e.event_type === "compile_error").length
    const runs = events.filter((e) => e.event_type === "run").length
    const latestEvent = events[0]
    const latestFormatted = latestEvent
      ? formatInstructorStudioEvent({
          eventType: latestEvent.event_type,
          tool: latestEvent.tool,
          fileName: latestEvent.file_name,
          errorFamily: latestEvent.error_family,
          errorMessage: latestEvent.error_message,
        })
      : null

    const lastActivityAt = maxIso([
      snapshot?.updated_at,
      snapshot?.instructor_updated_at,
      submission?.submitted_at,
      classroom?.created_at,
      latestEvent?.created_at,
    ])

    const lastActivityMs = lastActivityAt ? now - new Date(lastActivityAt).getTime() : null
    const snapshotFreshAt = maxIso([snapshot?.updated_at, snapshot?.instructor_updated_at])
    const snapshotAgeMs = snapshotFreshAt ? now - new Date(snapshotFreshAt).getTime() : null

    const status = deriveStatus({
      classroomStatus: classroom?.status ?? submission?.status ?? null,
      hasSubmission: Boolean(submission || classroom),
      lastActivityMs,
      latestEventType: latestEvent?.event_type ?? null,
      latestCoraTool: latestEvent?.tool ?? null,
      compileErrors,
      snapshotAgeMs,
    })

    const studentLive = firstNonEmptyCode(snapshot?.code)
    const instructorLive = firstNonEmptyCode(snapshot?.instructor_code)
    const instructorAt = snapshot?.instructor_updated_at
      ? new Date(snapshot.instructor_updated_at).getTime()
      : 0
    const studentAt = snapshot?.updated_at ? new Date(snapshot.updated_at).getTime() : 0
    const liveCode =
      instructorLive && (!studentLive || instructorAt >= studentAt) ? instructorLive : studentLive
    const submittedCode = firstNonEmptyCode(submission?.code, classroom?.code)
    const code = liveCode ?? submittedCode
    const codeSource: LiveClassroomStudentRow["codeSource"] = liveCode
      ? "live"
      : submittedCode
        ? "submitted"
        : null

    return {
      studentDbId: row.student_db_id,
      studentId: row.student_id,
      fullName: row.full_name,
      section: row.section,
      status,
      statusLabel: statusLabel(status),
      lastActivityAt,
      compileErrors,
      runs,
      code,
      codeSource,
      fileName: snapshot?.file_name ?? null,
      language: snapshot?.language ?? null,
      typingReplay: parseTypingReplay(snapshot?.typing_replay),
      studentCursor: parseLiveEditorCursor(snapshot?.student_cursor),
      instructorCursor: parseLiveEditorCursor(snapshot?.instructor_cursor),
      snapshotUpdatedAt: snapshotFreshAt,
      submissionStatus: classroom?.status ?? submission?.status ?? null,
      score: submission?.score != null ? Number(submission.score) : null,
      points: classroom?.points != null ? Number(classroom.points) : null,
      latestEventTitle: latestFormatted?.title ?? null,
      latestEventDetail: latestFormatted?.detail ?? null,
    }
  })

  students.sort((a, b) => {
    const priority = (s: LiveStudentStatus) => {
      switch (s) {
        case "needs_help":
          return 0
        case "error":
          return 1
        case "coding":
          return 2
        case "submitted":
          return 3
        case "review":
          return 4
        case "approved":
          return 5
        default:
          return 6
      }
    }
    const diff = priority(a.status) - priority(b.status)
    if (diff !== 0) return diff
    const aTime = a.lastActivityAt ? new Date(a.lastActivityAt).getTime() : 0
    const bTime = b.lastActivityAt ? new Date(b.lastActivityAt).getTime() : 0
    return bTime - aTime
  })

  const summary = {
    totalStudents: students.length,
    coding: students.filter((s) => s.status === "coding").length,
    errors: students.filter((s) => s.status === "error").length,
    needsHelp: students.filter((s) => s.status === "needs_help").length,
    submitted: students.filter((s) => s.status === "submitted").length,
    approved: students.filter((s) => s.status === "approved").length,
    notStarted: students.filter((s) => s.status === "not_started").length,
    review: students.filter((s) => s.status === "review").length,
  }

  const recent = (recentEvents as Array<{
    id: number
    student_db_id: number
    full_name: string
    event_type: string
    tool: string | null
    file_name: string | null
    error_family: string | null
    error_message: string | null
    created_at: string
  }>).slice(0, 25).map((row) => {
    const formatted = formatInstructorStudioEvent({
      eventType: row.event_type,
      tool: row.tool,
      fileName: row.file_name,
      errorFamily: row.error_family,
      errorMessage: row.error_message,
    })
    return {
      id: String(row.id),
      studentDbId: row.student_db_id,
      studentName: row.full_name,
      title: formatted.title,
      detail: formatted.detail,
      tone: formatted.tone,
      createdAt: row.created_at,
    }
  })

  return {
    assignmentId: assignment.id,
    title: assignment.title,
    session: assignment.session,
    isOpen: Boolean(openSession),
    liveSessionId: openSession?.sessionId ?? null,
    startedAt: openSession?.startedAt ?? assignment.created_at,
    polledAt: new Date().toISOString(),
    summary,
    students,
    recentEvents: recent,
  }
}

function maxIso(values: Array<string | null | undefined>): string | null {
  let best: number | null = null
  let bestValue: string | null = null
  for (const value of values) {
    if (!value) continue
    const ms = new Date(value).getTime()
    if (Number.isNaN(ms)) continue
    if (best == null || ms > best) {
      best = ms
      bestValue = value
    }
  }
  return bestValue
}
