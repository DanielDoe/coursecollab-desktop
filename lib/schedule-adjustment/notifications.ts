import { createNotification, createBulkNotifications } from "@/lib/create-notification"
import { sql } from "@/lib/db"

const STUDENT_LINK_BASE = "/student/dashboard-v2/schedule-adjustment"

export async function notifyScheduleAdjustmentStudents(params: {
  requestId: number
  courseId: number
  title: string
  message: string
  type?: string
}) {
  const studentIds = await sql`
    SELECT s.id
    FROM schedule_enrollment_snapshots snap
    JOIN students s ON s.id = snap.student_id
    WHERE snap.request_id = ${params.requestId}
  `
  const ids = (studentIds as { id: number }[]).map((r) => r.id)
  if (ids.length === 0) return 0

  await createBulkNotifications(ids, {
    type: params.type ?? "calendar",
    title: params.title,
    message: params.message,
    link: `${STUDENT_LINK_BASE}/${params.requestId}`,
  })
  return ids.length
}

export async function notifySingleStudent(params: {
  studentDbId: number
  title: string
  message: string
  requestId: number
  type?: string
}) {
  await createNotification({
    studentId: params.studentDbId,
    type: params.type ?? "calendar",
    title: params.title,
    message: params.message,
    link: `${STUDENT_LINK_BASE}/${params.requestId}`,
  })
}

export async function notifyPendingConsentReminders(requestId: number, courseId: number) {
  const pending = await sql`
    SELECT c.student_id
    FROM schedule_consents c
    WHERE c.request_id = ${requestId} AND c.status = 'pending'
  `
  const ids = (pending as { student_id: number }[]).map((r) => r.student_id)
  if (ids.length === 0) return 0

  await createBulkNotifications(ids, {
    type: "calendar",
    title: "Schedule change consent reminder",
    message: "Your instructor is waiting for your review and consent on a proposed class schedule change.",
    link: `${STUDENT_LINK_BASE}/${requestId}`,
  })
  return ids.length
}

export async function notifyAvailabilityReminder(requestId: number) {
  const rows = await sql`
    SELECT snap.student_id
    FROM schedule_enrollment_snapshots snap
    LEFT JOIN schedule_availability_responses r
      ON r.request_id = snap.request_id AND r.student_id = snap.student_id
    WHERE snap.request_id = ${requestId}
      AND r.submitted_at IS NULL
  `
  const ids = (rows as { student_id: number }[]).map((r) => r.student_id)
  if (ids.length === 0) return 0

  await createBulkNotifications(ids, {
    type: "calendar",
    title: "Class schedule availability poll",
    message: "Please submit your availability for a proposed class schedule adjustment.",
    link: `${STUDENT_LINK_BASE}/${requestId}`,
  })
  return ids.length
}

export async function notifyStructuredSessionReminders() {
  const upcoming = await sql`
    SELECT asess.id, asess.section, asess.class_title, asess.start_time, asess.late_threshold_minutes
    FROM attendance_sessions asess
    WHERE asess.session_type = 'STRUCTURED_COURSECOLLAB'
      AND asess.is_active = true
      AND COALESCE(asess.is_cancelled, false) = false
      AND (
        asess.start_time BETWEEN NOW() AND NOW() + INTERVAL '35 minutes'
        OR asess.start_time BETWEEN NOW() - INTERVAL '20 minutes' AND NOW() - INTERVAL '10 minutes'
      )
  `
  let sent = 0
  for (const session of upcoming as Array<{
    id: number
    section: string
    class_title: string
    start_time: string
    late_threshold_minutes: number
  }>) {
    const students = await sql`
      SELECT s.id
      FROM students s
      JOIN sessions sess ON sess.id = s.session_id
      LEFT JOIN attendance_records ar ON ar.session_id = ${session.id} AND ar.student_id = s.id
      WHERE s.deleted_at IS NULL
        AND TRIM(UPPER(sess.code)) = TRIM(UPPER(${session.section}))
        AND ar.id IS NULL
    `
    const ids = (students as { id: number }[]).map((r) => r.id)
    if (!ids.length) continue
    const start = new Date(session.start_time)
    const lateMinutes = Number(session.late_threshold_minutes ?? 20) || 20
    const lateUntil = new Date(start.getTime() + lateMinutes * 60_000)
    const lateLabel = lateUntil.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: "America/Chicago",
    })
    const minutesToStart = Math.round((start.getTime() - Date.now()) / 60000)
    const title =
      minutesToStart <= 0
        ? `Your ${session.section} Structured CourseCollab Session has started.`
        : "Upcoming Structured Session"
    const message =
      minutesToStart <= 0
        ? `Check in by ${lateLabel} to be recorded on time. After ${lateMinutes} minutes, check in remains open but will be recorded as Late.`
        : `${session.section} Structured CourseCollab Session starts soon. Attendance check in opens at session start.`
    await createBulkNotifications(ids, {
      type: "calendar",
      title,
      message,
      link: "/student/dashboard-v2",
    })
    sent += ids.length
  }
  return sent
}
