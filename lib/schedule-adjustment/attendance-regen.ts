import crypto from "crypto"
import { sql } from "@/lib/db"
import { convertCentralDateTimeToUtcISO } from "@/lib/timezone"
import type { ScheduleAdjustmentRequestRow } from "@/lib/schedule-adjustment/types"
import { arrangementFromRequest } from "@/lib/schedule-adjustment/arrangement"

const DAY_CODE_TO_JS: Record<string, number> = {
  SU: 0,
  MO: 1,
  TU: 2,
  WE: 3,
  TH: 4,
  FR: 5,
  SA: 6,
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function generateQRCode(sessionId: number, section: string): string {
  return `ATTEND_${sessionId}_${section}_${Date.now()}_${crypto.randomBytes(8).toString("hex")}`
}

function occurrencesFrom(dayCode: string, fromDate: string, until: Date): string[] {
  const jsDay = DAY_CODE_TO_JS[dayCode]
  if (jsDay == null) return []
  const cursor = new Date(`${fromDate}T12:00:00`)
  const dates: string[] = []
  while (cursor <= until) {
    if (cursor.getDay() === jsDay) dates.push(dateKey(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return dates
}

/** Populate instructor + structured attendance sessions from a pending consent request. */
export async function optimisticallyRegenerateAttendanceForRequestId(requestId: number): Promise<boolean> {
  const rows = await sql`SELECT * FROM schedule_adjustment_requests WHERE id = ${requestId} LIMIT 1`
  if (!rows.length) return false
  await regenerateAttendanceSessionsForRequest(rows[0] as ScheduleAdjustmentRequestRow)
  return true
}

export async function optimisticallyRegenerateAttendanceForConsentRequests(): Promise<number> {
  const rows = await sql`
    SELECT * FROM schedule_adjustment_requests
    WHERE archived_at IS NULL
      AND status = 'COLLECTING_CONSENT'
      AND section_code IS NOT NULL
      AND instructor_led_day IS NOT NULL
      AND structured_session_day IS NOT NULL
  `
  let count = 0
  for (const row of rows) {
    await regenerateAttendanceSessionsForRequest(row as ScheduleAdjustmentRequestRow)
    count++
  }
  return count
}

function normalizeEffectiveDate(value: unknown): string {
  if (value instanceof Date) {
    const y = value.getFullYear()
    const m = String(value.getMonth() + 1).padStart(2, "0")
    const d = String(value.getDate()).padStart(2, "0")
    return `${y}-${m}-${d}`
  }
  const text = String(value ?? "").trim()
  const iso = text.match(/^\d{4}-\d{2}-\d{2}/)
  if (iso) return iso[0]
  const parsed = new Date(text)
  if (Number.isNaN(parsed.getTime())) return text.slice(0, 10)
  return normalizeEffectiveDate(parsed)
}

function sessionKey(sessionType: string, start: Date | string): string {
  return `${sessionType}|${new Date(start).getTime()}`
}

export async function regenerateAttendanceSessionsForRequest(request: ScheduleAdjustmentRequestRow) {
  const arrangement = arrangementFromRequest(request)
  if (!arrangement || !request.section_code) return

  const instructorRows = await sql`
    SELECT id FROM instructors WHERE id = ${request.created_by_id} LIMIT 1
  `
  const instructorId = Number((instructorRows[0] as { id?: number } | undefined)?.id ?? request.created_by_id)
  const section = request.section_code
  const lateMinutes = Number(request.attendance_late_threshold_minutes ?? 20) || 20
  const termEnd = new Date("2026-12-09T12:00:00Z")
  const effective = normalizeEffectiveDate(arrangement.effectiveDate)

  await sql`
    DELETE FROM attendance_sessions
    WHERE section = ${section}
      AND start_time >= ${effective}::date
      AND id NOT IN (
        SELECT session_id FROM attendance_records WHERE session_id IS NOT NULL
      )
  `

  const meetings = [
    {
      kind: "INSTRUCTOR_LED" as const,
      day: arrangement.instructorLed.day,
      start: arrangement.instructorLed.startTime.slice(0, 5),
      end: arrangement.instructorLed.endTime.slice(0, 5),
      title: `${section} Instructor Led Session`,
      selfCheckin: false,
    },
    {
      kind: "STRUCTURED_COURSECOLLAB" as const,
      day: arrangement.structured.day,
      start: arrangement.structured.startTime.slice(0, 5),
      end: arrangement.structured.endTime.slice(0, 5),
      title: `${section} Structured CourseCollab Session`,
      selfCheckin: true,
    },
  ]

  const keptRows = await sql`
    SELECT start_time, session_type
    FROM attendance_sessions
    WHERE section = ${section}
      AND start_time >= ${effective}::date
      AND COALESCE(is_cancelled, false) = false
  `
  const keptKeys = new Set(
    keptRows.map((row) => {
      const r = row as { start_time: Date | string; session_type: string }
      return sessionKey(r.session_type, r.start_time)
    }),
  )

  type PendingSession = {
    kind: "INSTRUCTOR_LED" | "STRUCTURED_COURSECOLLAB"
    title: string
    selfCheckin: boolean
    startUtc: string
    endUtc: string
  }

  const pending: PendingSession[] = []

  for (const meeting of meetings) {
    for (const date of occurrencesFrom(meeting.day, effective, termEnd)) {
      const startUtc = convertCentralDateTimeToUtcISO(date, meeting.start)
      const endUtc = convertCentralDateTimeToUtcISO(date, meeting.end)
      const key = sessionKey(meeting.kind, startUtc)
      if (keptKeys.has(key)) continue
      pending.push({
        kind: meeting.kind,
        title: meeting.title,
        selfCheckin: meeting.selfCheckin,
        startUtc,
        endUtc,
      })
    }
  }

  const insertedIds: number[] = []
  for (const row of pending) {
    const inserted = await sql`
      INSERT INTO attendance_sessions (
        instructor_id, course_id, section, class_title, start_time, end_time,
        location_lat, location_long, radius_meters, qr_code, qr_expires_at, is_active,
        session_type, schedule_version_id, late_threshold_minutes, request_id, self_checkin_enabled
      ) VALUES (
        ${instructorId}, ${request.course_id}, ${section}, ${row.title},
        ${row.startUtc}::timestamp, ${row.endUtc}::timestamp,
        NULL, NULL, NULL, 'temp',
        (${row.endUtc}::timestamp + interval '30 minutes'), true,
        ${row.kind}, ${request.schedule_version_id ?? null}, ${lateMinutes}, ${request.id},
        ${row.selfCheckin}
      )
      RETURNING id
    `
    insertedIds.push(Number((inserted[0] as { id: number }).id))
  }

  for (const sessionId of insertedIds) {
    await sql`
      UPDATE attendance_sessions SET qr_code = ${generateQRCode(sessionId, section)} WHERE id = ${sessionId}
    `
  }
}
