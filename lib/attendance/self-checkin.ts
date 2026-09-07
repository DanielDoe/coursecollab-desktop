import { sql } from "@/lib/db"
import { CENTRAL_TIMEZONE } from "@/lib/timezone"
import { toZonedTime } from "date-fns-tz"
import { parseAttendancePolicy } from "@/lib/course-policy-settings"
import { syncGradebookForAttendanceMark } from "@/lib/grades"
import {
  getStructuredCheckInWindow,
  structuredCheckInPhase,
  structuredCheckInStatusForInstant,
} from "@/lib/attendance/structured-check-in-window"
import { recordAttendanceAudit } from "@/lib/attendance/self-checkin-audit"

export type AttendanceMarkStatus = "present" | "late" | "absent" | "excused"

export { recordAttendanceAudit } from "@/lib/attendance/self-checkin-audit"

function scoreForStatus(status: AttendanceMarkStatus, policy: ReturnType<typeof parseAttendancePolicy>) {
  if (status === "present") return Number(policy.present_score ?? 100) / 100
  if (status === "late") return Number(policy.late_score ?? 50) / 100
  if (status === "excused") return policy.excused_full_credit ? Number(policy.present_score ?? 100) / 100 : 0
  return 0
}

export async function loadAttendanceScorePolicy(courseId: number | null) {
  if (!courseId) return parseAttendancePolicy(null)
  try {
    const rows = await sql`
      SELECT attendance_policy FROM courses WHERE id = ${courseId} LIMIT 1
    `
    return parseAttendancePolicy((rows[0] as { attendance_policy?: unknown } | undefined)?.attendance_policy)
  } catch {
    return parseAttendancePolicy(null)
  }
}

function isStructuredSession(session: Record<string, unknown>): boolean {
  return (
    String(session.session_type ?? "") === "STRUCTURED_COURSECOLLAB" ||
    session.self_checkin_enabled === true
  )
}

type SessionRow = Record<string, unknown> & {
  id: number
  section?: string | null
  class_title?: string | null
  start_time: string | Date
  end_time: string | Date
  qr_expires_at?: string | Date | null
  late_threshold_minutes?: number | null
  session_type?: string | null
  self_checkin_enabled?: boolean | null
  schedule_version_id?: number | null
  resolved_course_id?: number | null
}

async function loadStudentForSession(studentDbId: number) {
  const student = await sql`
    SELECT s.id, s.full_name, s.student_id, sess.code as section, COALESCE(s.course_id, sess.course_id) AS course_id
    FROM students s
    LEFT JOIN sessions sess ON sess.id = s.session_id
    WHERE s.id = ${studentDbId} AND s.deleted_at IS NULL
    LIMIT 1
  `
  if (!student.length) throw new Error("Student not found")
  return student[0] as {
    id: number
    full_name: string
    student_id: string
    section: string | null
    course_id: number | null
  }
}

async function loadActiveSession(sessionId: number): Promise<SessionRow | null> {
  const sessions = await sql`
    SELECT asess.*, c.id AS resolved_course_id
    FROM attendance_sessions asess
    LEFT JOIN sessions sess ON TRIM(UPPER(sess.code)) = TRIM(UPPER(asess.section))
    LEFT JOIN courses c ON c.id = COALESCE(asess.course_id, sess.course_id)
    WHERE asess.id = ${sessionId}
      AND asess.is_active = true
      AND COALESCE(asess.is_cancelled, false) = false
    LIMIT 1
  `
  return (sessions[0] as SessionRow | undefined) ?? null
}

/** After the structured window closes, write an absent record (0 pts) if the student never checked in. */
export async function finalizeStructuredAbsentIfNeeded(params: {
  studentDbId: number
  session: SessionRow
  now?: Date
}): Promise<{ finalized: boolean; status?: AttendanceMarkStatus }> {
  if (!isStructuredSession(params.session)) return { finalized: false }

  const existing = await sql`
    SELECT id FROM attendance_records
    WHERE student_id = ${params.studentDbId} AND session_id = ${params.session.id}
    LIMIT 1
  `
  if (existing.length) return { finalized: false }

  const now = params.now ?? new Date()
  const window = getStructuredCheckInWindow({
    startTime: params.session.start_time,
    endTime: params.session.end_time,
    lateThresholdMinutes: params.session.late_threshold_minutes,
    qrExpiresAt: params.session.qr_expires_at,
  })
  if (!window) return { finalized: false }
  if (structuredCheckInPhase(now, window) !== "closed") return { finalized: false }

  const studentData = await loadStudentForSession(params.studentDbId)
  if (String(studentData.section ?? "").trim() !== String(params.session.section ?? "").trim()) {
    return { finalized: false }
  }

  const policy = await loadAttendanceScorePolicy(
    Number(params.session.resolved_course_id ?? studentData.course_id ?? 0) || null,
  )
  const points = scoreForStatus("absent", policy)

  await sql`
    INSERT INTO attendance_records (
      student_id, session_id, student_name, student_number, section,
      status, points_earned, timestamp, check_in_method
    ) VALUES (
      ${params.studentDbId}, ${params.session.id}, ${studentData.full_name}, ${studentData.student_id},
      ${studentData.section}, 'absent', ${points}, ${now.toISOString()}::timestamp, 'auto_absent'
    )
  `
  await recordAttendanceAudit({
    sessionId: params.session.id,
    studentId: params.studentDbId,
    originalStatus: null,
    newStatus: "absent",
    checkInTimestamp: now,
    scheduleVersion:
      params.session.schedule_version_id != null ? Number(params.session.schedule_version_id) : null,
    sessionType: String(params.session.session_type ?? "STRUCTURED_COURSECOLLAB"),
    actorId: null,
  })
  try {
    await syncGradebookForAttendanceMark(params.studentDbId, studentData.section)
  } catch {
    // best-effort
  }
  return { finalized: true, status: "absent" }
}

export async function finalizeStructuredAbsentsForStudent(studentDbId: number, now = new Date()) {
  const rows = (await sql`
    SELECT asess.*, c.id AS resolved_course_id
    FROM attendance_sessions asess
    JOIN students s ON s.id = ${studentDbId} AND s.deleted_at IS NULL
    JOIN sessions sess ON sess.id = s.session_id
      AND TRIM(UPPER(asess.section)) = TRIM(UPPER(sess.code))
    LEFT JOIN courses c ON c.id = COALESCE(asess.course_id, sess.course_id)
    LEFT JOIN attendance_records ar ON ar.session_id = asess.id AND ar.student_id = s.id
    WHERE asess.is_active = true
      AND COALESCE(asess.is_cancelled, false) = false
      AND (asess.session_type = 'STRUCTURED_COURSECOLLAB' OR asess.self_checkin_enabled = true)
      AND ar.id IS NULL
  `) as SessionRow[]

  let finalized = 0
  for (const session of rows) {
    const result = await finalizeStructuredAbsentIfNeeded({ studentDbId, session, now })
    if (result.finalized) finalized += 1
  }
  return finalized
}

export async function selfCheckInStructuredSession(params: {
  studentDbId: number
  sessionId: number
}) {
  const now = new Date()
  const session = await loadActiveSession(params.sessionId)
  if (!session) throw new Error("Attendance session is not active")
  if (!isStructuredSession(session)) {
    throw new Error("Self check-in is only available for structured CourseCollab sessions")
  }

  const studentData = await loadStudentForSession(params.studentDbId)
  if (String(studentData.section ?? "").trim() !== String(session.section ?? "").trim()) {
    throw new Error("You are not enrolled in this section")
  }

  await finalizeStructuredAbsentIfNeeded({ studentDbId: params.studentDbId, session, now })

  const existing = await sql`
    SELECT id, status, timestamp FROM attendance_records
    WHERE student_id = ${params.studentDbId} AND session_id = ${params.sessionId}
    LIMIT 1
  `
  if (existing.length) {
    const row = existing[0] as { status: string; timestamp: string }
    return {
      alreadyRecorded: true,
      status: row.status,
      checkedInAt: row.timestamp,
      sessionTitle: String(session.class_title ?? "Structured CourseCollab Session"),
    }
  }

  const window = getStructuredCheckInWindow({
    startTime: session.start_time,
    endTime: session.end_time,
    lateThresholdMinutes: session.late_threshold_minutes,
    qrExpiresAt: session.qr_expires_at,
  })
  if (!window) throw new Error("Session time not scheduled")

  const phase = structuredCheckInPhase(now, window)
  if (phase === "closed") {
    await finalizeStructuredAbsentIfNeeded({ studentDbId: params.studentDbId, session, now })
    throw new Error("Attendance window has closed — marked missed (0 pts)")
  }

  const status = structuredCheckInStatusForInstant(now, {
    startTime: session.start_time,
    endTime: session.end_time,
    lateThresholdMinutes: session.late_threshold_minutes,
    qrExpiresAt: session.qr_expires_at,
  })
  const policy = await loadAttendanceScorePolicy(
    Number(session.resolved_course_id ?? studentData.course_id ?? 0) || null,
  )
  const points = scoreForStatus(status, policy)

  await sql`
    INSERT INTO attendance_records (
      student_id, session_id, student_name, student_number, section,
      status, points_earned, timestamp, check_in_method
    ) VALUES (
      ${params.studentDbId}, ${params.sessionId}, ${studentData.full_name}, ${studentData.student_id},
      ${studentData.section}, ${status}, ${points}, ${now.toISOString()}::timestamp, 'self_checkin'
    )
  `
  await recordAttendanceAudit({
    sessionId: params.sessionId,
    studentId: params.studentDbId,
    originalStatus: null,
    newStatus: status,
    checkInTimestamp: now,
    scheduleVersion: session.schedule_version_id != null ? Number(session.schedule_version_id) : null,
    sessionType: String(session.session_type ?? "STRUCTURED_COURSECOLLAB"),
    actorId: params.studentDbId,
  })
  try {
    await syncGradebookForAttendanceMark(params.studentDbId, studentData.section)
  } catch {
    // scoring sync is best-effort
  }

  const nowCT = toZonedTime(now, CENTRAL_TIMEZONE)
  return {
    alreadyRecorded: false,
    status,
    pointsEarned: points,
    checkedInAt: now.toISOString(),
    checkedInLocal: nowCT.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
    sessionTitle: String(session.class_title ?? "Structured CourseCollab Session"),
    sessionType: "Structured CourseCollab Session",
  }
}

export async function getTodayStructuredSessionForStudent(studentDbId: number) {
  await finalizeStructuredAbsentsForStudent(studentDbId)

  const rows = await sql`
    SELECT asess.*, ar.status AS my_status, ar.timestamp AS my_checkin
    FROM students s
    JOIN sessions sess ON sess.id = s.session_id
    JOIN attendance_sessions asess ON TRIM(UPPER(asess.section)) = TRIM(UPPER(sess.code))
    LEFT JOIN attendance_records ar ON ar.session_id = asess.id AND ar.student_id = s.id
    WHERE s.id = ${studentDbId}
      AND s.deleted_at IS NULL
      AND asess.is_active = true
      AND COALESCE(asess.is_cancelled, false) = false
      AND asess.session_type = 'STRUCTURED_COURSECOLLAB'
      AND (((asess.start_time AT TIME ZONE 'UTC') AT TIME ZONE ${CENTRAL_TIMEZONE})::date =
        ((NOW() AT TIME ZONE ${CENTRAL_TIMEZONE})::date))
    ORDER BY asess.start_time ASC
    LIMIT 1
  `
  return rows[0] ?? null
}
