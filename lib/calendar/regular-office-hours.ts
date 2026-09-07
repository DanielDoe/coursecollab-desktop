import { sql } from "@/lib/db"
import { formatWallClockIso } from "@/lib/syllabus/calendar-export"
import {
  ensureOfficeHoursCourseScopeColumns,
  hasRegularOfficeHoursCourseIdColumn,
} from "@/lib/office-hours-course-scope"
import { loadSyllabusOfficeHoursForOffering } from "@/lib/office-hours-syllabus-fallback"

export type RegularOfficeHourOccurrence = {
  id: string
  startTime: string
  endTime: string
  location: string
  lastModified: string
}

type SlotRow = {
  id: string
  day_of_week: number
  start_time: unknown
  end_time: unknown
  office_location?: string | null
  session_id?: number | null
  updated_at?: string | Date | null
  course_id?: number
}

function parseTimeParts(value: unknown): { hour: number; minute: number } | null {
  const text = typeof value === "string" ? value : value != null ? String(value) : ""
  const match = text.match(/(\d{1,2}):(\d{2})/)
  if (!match) return null
  const hour = Number.parseInt(match[1], 10)
  const minute = Number.parseInt(match[2], 10)
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null
  return { hour, minute }
}

function dateKey(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

function pickScopedSlots(rows: SlotRow[], sessionId: number | null): SlotRow[] {
  if (sessionId != null) {
    const matching = rows.filter((row) => Number(row.session_id) === sessionId)
    if (matching.length > 0) return matching
  }
  const courseWide = rows.filter((row) => row.session_id == null)
  return courseWide.length > 0 ? courseWide : rows
}

function slotLastModified(slot: SlotRow): string {
  const raw = slot.updated_at
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) return raw.toISOString()
  if (typeof raw === "string" && raw.trim()) {
    const parsed = new Date(raw)
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString()
  }
  return new Date().toISOString()
}

function expandSlots(
  slots: SlotRow[],
  rangeStart: Date,
  rangeEnd: Date,
  courseId: number,
  sessionId: number | null,
): RegularOfficeHourOccurrence[] {
  const events: RegularOfficeHourOccurrence[] = []
  const cursor = new Date(rangeStart)
  cursor.setHours(0, 0, 0, 0)
  const end = new Date(rangeEnd)
  end.setHours(23, 59, 59, 999)
  const sessionKey = sessionId ?? 0

  while (cursor <= end) {
    const dow = cursor.getDay()
    const y = cursor.getFullYear()
    const m = cursor.getMonth() + 1
    const d = cursor.getDate()
    for (const slot of slots) {
      if (Number(slot.day_of_week) !== dow) continue
      const start = parseTimeParts(slot.start_time)
      const finish = parseTimeParts(slot.end_time)
      if (!start || !finish) continue
      events.push({
        id: `oh-c${courseId}-s${sessionKey}-d${dow}-${dateKey(y, m, d)}`,
        startTime: formatWallClockIso(y, m, d, start.hour, start.minute),
        endTime: formatWallClockIso(y, m, d, finish.hour, finish.minute),
        location: String(slot.office_location ?? "").trim(),
        lastModified: slotLastModified(slot),
      })
    }
    cursor.setDate(cursor.getDate() + 1)
  }
  return events
}

export async function buildRegularOfficeHourOccurrences(params: {
  courseId: number
  sessionId: number | null
  rangeStart: Date
  rangeEnd: Date
}): Promise<RegularOfficeHourOccurrence[]> {
  const { courseId, sessionId, rangeStart, rangeEnd } = params
  await ensureOfficeHoursCourseScopeColumns()

  let slots: SlotRow[] = []
  const hasCourseCol = await hasRegularOfficeHoursCourseIdColumn()
  if (hasCourseCol) {
    try {
      const rows = (await sql`
        SELECT id, day_of_week, start_time, end_time, office_location, session_id, updated_at
        FROM regular_office_hours
        WHERE course_id = ${courseId}
        ORDER BY day_of_week, start_time
      `) as Array<{
        id: number
        day_of_week: number
        start_time: unknown
        end_time: unknown
        office_location?: string | null
        session_id?: number | null
        updated_at?: string | Date | null
      }>
      slots = pickScopedSlots(
        rows.map((row) => ({
          id: String(row.id),
          day_of_week: Number(row.day_of_week),
          start_time: row.start_time,
          end_time: row.end_time,
          office_location: row.office_location,
          session_id: row.session_id != null ? Number(row.session_id) : null,
          updated_at: row.updated_at,
          course_id: courseId,
        })),
        sessionId,
      )
    } catch {
      slots = []
    }
  }

  if (slots.length === 0) {
    const syllabus = await loadSyllabusOfficeHoursForOffering(courseId, sessionId)
    slots = syllabus.slots.map((slot, index) => ({
      id: `syllabus:${index}:${slot.dayOfWeek}:${slot.startTime}`,
      day_of_week: slot.dayOfWeek,
      start_time: slot.startTime,
      end_time: slot.endTime,
      office_location: syllabus.officeLocation,
      session_id: sessionId,
      updated_at: new Date(),
      course_id: courseId,
    }))
  }

  return expandSlots(slots, rangeStart, rangeEnd, courseId, sessionId)
}
