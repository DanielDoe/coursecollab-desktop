import { type NextRequest } from "next/server"
import { sql } from "@/lib/db"
import { getOpenLiveClassroomSession } from "@/lib/codebench-live-classroom"
import { ensureCodebenchLiveSnapshotsSchema } from "@/lib/codebench-live-session-schema"
import { ensureCodebenchStudioEventsSchema } from "@/lib/codebench-studio-schema"
import { studioEventInCourseSql } from "@/lib/codebench-studio-course-scope"
import { formatInstructorStudioEvent } from "@/lib/codebench-instructor-student-activity"
import { studentInOfferingSqlFromRequest } from "@/lib/instructor-session-scope"
import { studentMatchesLiveAssignmentSession } from "@/lib/classroom-submission-scope"
import { selectFaithfulTypingReplay, typingReplaySince } from "@/lib/codebench-live-replay"
import { listBlockedLiveJoins, recordRosterSample } from "@/lib/codebench-live-activity-log"
import type {
  LiveClassroomSessionPayload,
  LiveClassroomStudentRow,
  LiveStudentStatus,
} from "@/lib/codebench-live-classroom-types"
import {
  mergeLiveRosterIdentities,
  resolveInstructorLiveViewCode,
  type LiveRosterIdentity,
} from "@/lib/codebench-live-session-roster"

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
  // ALTER TABLE takes an ACCESS EXCLUSIVE lock on students even when the column
  // exists; on a 1s instructor poll that stalls every other read of students.
  if (!studentsDeletedAtReady) {
    studentsDeletedAtReady = sql`ALTER TABLE students ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`
      .then(() => undefined)
      .catch(() => {
        /* column may already exist or migration unavailable */
      })
  }
  await studentsDeletedAtReady
}

let studentsDeletedAtReady: Promise<void> | null = null

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

/** Roster order ignores keystrokes. Coding and joined stay in one group. */
function rosterBucket(status: LiveStudentStatus): "attention" | "present" | "finished" | "approved" | "absent" {
  switch (status) {
    case "needs_help":
    case "error":
      return "attention"
    case "coding":
    case "joined":
      return "present"
    case "submitted":
    case "review":
      return "finished"
    case "approved":
      return "approved"
    default:
      return "absent"
  }
}

function rosterRank(bucket: ReturnType<typeof rosterBucket>): number {
  switch (bucket) {
    case "attention":
      return 0
    case "present":
      return 1
    case "finished":
      return 2
    case "approved":
      return 3
    default:
      return 4
  }
}

function statusLabel(status: LiveStudentStatus): string {
  switch (status) {
    case "not_started":
      return "Not started"
    case "joined":
      return "Joined"
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

/** Editor heartbeats are every 2s. After this gap the student has left the live editor. */
const LIVE_ACTIVITY_MS = 45 * 1000

/** Five missed 2s heartbeats. */
const LIVE_PRESENCE_TIMEOUT_MS = 10 * 1000

/** Per-student window for error/run counts, so one busy student can't crowd out the class. */
const STUDIO_EVENTS_PER_STUDENT = 20

function isActiveRecently(input: {
  lastActivityMs: number | null
  snapshotAgeMs: number | null
}): boolean {
  return (
    (input.lastActivityMs != null && input.lastActivityMs < LIVE_ACTIVITY_MS) ||
    (input.snapshotAgeMs != null && input.snapshotAgeMs < LIVE_ACTIVITY_MS)
  )
}

/** Newest compile wins. A later clean build clears earlier faults from this session. */
function currentCompileFault(
  events: Array<{ event_type: string; error_message: string | null }>,
): { count: number; messages: string[] } {
  const latest = events.find(
    (event) => event.event_type === "compile_error" || event.event_type === "compile_success",
  )
  if (!latest || latest.event_type === "compile_success") return { count: 0, messages: [] }
  const message = latest.error_message?.trim()
  return { count: 1, messages: message ? [message.slice(0, 180)] : [] }
}

function deriveStatus(input: {
  classroomStatus: string | null
  hasSubmission: boolean
  lastActivityMs: number | null
  latestEventType: string | null
  latestCoraTool: string | null
  hasCurrentCompileError: boolean
  snapshotAgeMs: number | null
  connectedThisSession: boolean
}): LiveStudentStatus {
  const status = String(input.classroomStatus ?? "").toLowerCase()
  const activeRecently = isActiveRecently(input)

  if (activeRecently) {
    if (input.hasCurrentCompileError) return "error"
    if (input.latestEventType === "suggest_fix") return "needs_help"
    if (input.latestEventType === "cora_tool" && input.latestCoraTool === "debug") return "needs_help"
    return "coding"
  }

  // In the room but not editing or compiling. This is Joined, even if they already
  // have a submission from earlier in the class.
  if (input.connectedThisSession) return "joined"

  if (status === "approved") return "approved"
  if (status === "rejected" || status === "needs_review") return "review"
  if (input.hasSubmission || status === "pending") return "submitted"
  return "not_started"
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
  focusStudentDbId?: number | null,
  options: { includeReplay?: boolean } = {},
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
        updated_at,
        student_left_at,
        student_joined_at,
        student_active_at,
        (EXTRACT(EPOCH FROM (NOW() - student_joined_at)) * 1000)::float8 AS joined_age_ms,
        student_cursor,
        instructor_cursor
      FROM codebench_live_snapshots
      WHERE assignment_id = ${assignmentId}
    `.catch((error) => {
      console.error("[live-session] snapshots", error)
      return []
    }),
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
      FROM (
        SELECT
          e.*,
          ROW_NUMBER() OVER (PARTITION BY e.student_id ORDER BY e.created_at DESC) AS student_rank
        FROM codebench_studio_events e
        WHERE ${sql.unsafe(eventCourseMatch)}
          AND e.created_at >= GREATEST(
            ${assignment.created_at}::timestamptz,
            COALESCE(${openSession?.startedAt ?? null}::timestamptz, ${assignment.created_at}::timestamptz)
          )
          AND (e.assignment_id = ${assignmentId} OR e.assignment_tagged = false)
      ) e
      JOIN students s ON s.id = e.student_id
      WHERE e.student_rank <= ${STUDIO_EVENTS_PER_STUDENT}
        AND ${sql.unsafe(scopeWhere)}
      ORDER BY e.created_at DESC
    `.catch((error) => {
      console.error("[live-session] studio events", error)
      return []
    }),
  ])

  const filteredStudents = studentRows.filter((row) =>
    studentMatchesLiveAssignmentSession(assignmentSession, row.session_code, row.section),
  )

  const snapshotByStudent = new Map<number, (typeof snapshotRows)[number]>()
  for (const row of snapshotRows as Array<{
    student_id: number
    code: string
    instructor_code?: string | null
    instructor_updated_at?: string | null
    file_name: string | null
    language: string | null
    updated_at: string
    student_left_at?: string | null
    student_joined_at?: string | null
    student_active_at?: string | null
    joined_age_ms?: number | string | null
    student_cursor?: unknown
    instructor_cursor?: unknown
  }>) {
    snapshotByStudent.set(Number(row.student_id), row)
  }

  // Normalize ids: DB drivers can return string ids and Set/Map lookups are type-sensitive —
  // a string "42" here silently hid live students from the roster join path.
  const enrolledIds = new Set(filteredStudents.map((row) => Number(row.student_db_id)))
  const missingSnapshotIds = [...snapshotByStudent.keys()].filter((id) => Number.isFinite(id) && id > 0 && !enrolledIds.has(id))
  let joinedFromSnapshots: LiveRosterIdentity[] = []
  if (missingSnapshotIds.length > 0) {
    const idList = missingSnapshotIds.map((id) => Math.trunc(id)).join(", ")
    const joinerSelect = sql`
      SELECT
        s.id AS student_db_id,
        s.student_id,
        s.full_name,
        COALESCE(NULLIF(TRIM(s.section), ''), NULLIF(TRIM(sess.code), '')) AS section,
        sess.code AS session_code
      FROM students s
      LEFT JOIN sessions sess ON sess.id = s.session_id
      WHERE s.id IN (${sql.unsafe(idList)})
        AND s.deleted_at IS NULL
    `
    joinedFromSnapshots = ((await joinerSelect.catch(() =>
      sql`
        SELECT
          s.id AS student_db_id,
          s.student_id,
          s.full_name,
          COALESCE(NULLIF(TRIM(s.section), ''), NULLIF(TRIM(sess.code), '')) AS section,
          sess.code AS session_code
        FROM students s
        LEFT JOIN sessions sess ON sess.id = s.session_id
        WHERE s.id IN (${sql.unsafe(idList)})
      `.catch(() => []),
    )) as LiveRosterIdentity[])
  }
  const rosterStudents = mergeLiveRosterIdentities(filteredStudents, joinedFromSnapshots)

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
    const studentDbId = Number(row.student_db_id)
    const list = eventsByStudent.get(studentDbId) ?? []
    list.push(row)
    eventsByStudent.set(studentDbId, list)
  }
  for (const [studentDbId, list] of eventsByStudent) {
    list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    eventsByStudent.set(studentDbId, list)
  }

  const now = Date.now()
  const sessionStartedAtMs = openSession ? new Date(openSession.startedAt).getTime() : Number.NaN

  const students: LiveClassroomStudentRow[] = rosterStudents.map((row) => {
    const studentDbId = Number(row.student_db_id)
    const snapshot = snapshotByStudent.get(studentDbId)
    const submission = submissionByStudent.get(studentDbId)
    const classroom = classroomByStudent.get(studentDbId)
    const events = eventsByStudent.get(studentDbId) ?? []

    const currentFault = currentCompileFault(events)
    const compileErrors = currentFault.count
    const compileErrorMessages = currentFault.messages
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
      submission?.submitted_at,
      classroom?.created_at,
      latestEvent?.created_at,
    ])

    // Faculty "live/coding" follows the student stream only — instructor_updated_at
    // would otherwise keep an empty editor looking live after a help-edit.
    const snapshotFreshAt = snapshot?.updated_at ?? null
    const joinedAtMs = snapshot?.student_joined_at ? new Date(snapshot.student_joined_at).getTime() : Number.NaN
    const leftAtMs = snapshot?.student_left_at ? new Date(snapshot.student_left_at).getTime() : Number.NaN
    const activeAtMs = snapshot?.student_active_at ? new Date(snapshot.student_active_at).getTime() : Number.NaN
    const eventAtMs = latestEvent?.created_at ? new Date(latestEvent.created_at).getTime() : Number.NaN
    // The open editor re-stamps student_joined_at on every heartbeat, so a stale
    // stamp means the leave never arrived (crash, sleep, network drop).
    const joinedAgeMs = snapshot?.joined_age_ms == null ? Number.NaN : Number(snapshot.joined_age_ms)
    const inRoom =
      Number.isFinite(joinedAtMs) &&
      Number.isFinite(sessionStartedAtMs) &&
      joinedAtMs >= sessionStartedAtMs &&
      (!Number.isFinite(leftAtMs) || joinedAtMs > leftAtMs) &&
      Number.isFinite(joinedAgeMs) &&
      joinedAgeMs < LIVE_PRESENCE_TIMEOUT_MS
    // Compare against the session start, not joined_at: heartbeats re-stamp joined_at
    // every 2s, which made a compile error or burst of typing stop counting almost at once.
    const codeAgeMs =
      inRoom && Number.isFinite(activeAtMs) && activeAtMs >= sessionStartedAtMs ? now - activeAtMs : null
    const eventAgeMs =
      inRoom && Number.isFinite(eventAtMs) && eventAtMs >= sessionStartedAtMs ? now - eventAtMs : null

    const status = deriveStatus({
      classroomStatus: classroom?.status ?? submission?.status ?? null,
      hasSubmission: Boolean(submission || classroom),
      lastActivityMs: eventAgeMs,
      latestEventType: latestEvent?.event_type ?? null,
      latestCoraTool: latestEvent?.tool ?? null,
      hasCurrentCompileError: compileErrors > 0,
      snapshotAgeMs: codeAgeMs,
      connectedThisSession: inRoom,
    })

    const submittedCode = firstNonEmptyCode(submission?.code, classroom?.code)
    const { code, codeSource } = resolveInstructorLiveViewCode({
      studentSnapshotCode: typeof snapshot?.code === "string" ? snapshot.code : null,
      submittedCode,
    })

    return {
      studentDbId: row.student_db_id,
      studentId: row.student_id,
      fullName: row.full_name,
      section: row.section,
      status,
      statusLabel: statusLabel(status),
      lastActivityAt,
      compileErrors,
      compileErrorMessages,
      runs,
      code,
      codeSource,
      fileName: snapshot?.file_name ?? null,
      language: snapshot?.language ?? null,
      typingReplay: null,
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
    const diff = rosterRank(rosterBucket(a.status)) - rosterRank(rosterBucket(b.status))
    if (diff !== 0) return diff
    return a.fullName.localeCompare(b.fullName, undefined, { sensitivity: "base" })
  })

  if (focusStudentDbId != null && focusStudentDbId > 0 && options.includeReplay !== false) {
    const replayRows = await sql`
      SELECT typing_replay
      FROM codebench_live_snapshots
      WHERE assignment_id = ${assignmentId}
        AND student_id = ${focusStudentDbId}
      LIMIT 1
    `.catch((error) => {
      console.error("[live-session] focused replay", error)
      return []
    })
    const focused = students.find((student) => student.studentDbId === focusStudentDbId)
    if (focused) {
      focused.typingReplay = typingReplaySince(
        selectFaithfulTypingReplay(
          (replayRows[0] as { typing_replay?: unknown } | undefined)?.typing_replay,
          focused.code,
        ),
        Number.isFinite(sessionStartedAtMs) ? sessionStartedAtMs : null,
      )
    }
  }

  const summary = {
    totalStudents: students.length,
    coding: students.filter((s) => s.status === "coding").length,
    errors: students.filter((s) => s.status === "error").length,
    needsHelp: students.filter((s) => s.status === "needs_help").length,
    submitted: students.filter((s) => s.status === "submitted").length,
    approved: students.filter((s) => s.status === "approved").length,
    joined: students.filter((s) => s.status === "joined").length,
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

  const liveEditorStatuses = new Set(["joined", "coding", "error", "needs_help"])
  const inEditorIds = new Set(
    students.filter((student) => liveEditorStatuses.has(student.status)).map((student) => student.studentDbId),
  )
  const openSessionStartIso =
    openSession && Number.isFinite(sessionStartedAtMs) ? new Date(sessionStartedAtMs).toISOString() : null
  const blockedJoins = openSessionStartIso
    ? (await listBlockedLiveJoins(assignment.id, openSessionStartIso)).filter(
        (blocked) => !inEditorIds.has(blocked.studentDbId),
      )
    : []

  if (openSession) {
    void recordRosterSample({
      courseId,
      assignmentId: assignment.id,
      liveSessionId: openSession.sessionId,
      students: students.map((student) => ({
        studentId: student.studentDbId,
        status: student.status,
        codeChars: student.code?.length ?? null,
      })),
    })
  }

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
    blockedJoins,
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
