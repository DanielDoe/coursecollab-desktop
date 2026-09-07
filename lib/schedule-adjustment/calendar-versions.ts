import type { ParsedClassSchedule, SyllabusCalendarContext } from "@/lib/syllabus/calendar-export"
import { expandClassMeetingsForRange, formatWallClockIso } from "@/lib/syllabus/calendar-export"

export type DatedScheduleVersion = {
  meetingType: string
  schedule: ParsedClassSchedule
  location?: string
  scheduleText: string
  effectiveFrom: string
  effectiveUntil: string | null
}

function toDateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

export function pickVersionForDate(
  versions: DatedScheduleVersion[],
  date: Date,
  meetingType = "lecture",
): DatedScheduleVersion | null {
  const key = toDateKey(date)
  const matches = versions.filter((v) => {
    if (v.meetingType !== meetingType) return false
    if (v.effectiveFrom > key) return false
    if (v.effectiveUntil != null && v.effectiveUntil < key) return false
    return true
  })
  return matches.sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0] ?? null
}

/** Expand a date range using versioned schedules so past meetings keep the old time. */
export function expandVersionedClassMeetingsForRange(params: {
  versions: DatedScheduleVersion[]
  fallbackSchedule: ParsedClassSchedule | null
  fallbackLocation?: string
  context: SyllabusCalendarContext
  rangeStart: Date
  rangeEnd: Date
  meetingType?: string
}) {
  const meetingType = params.meetingType ?? "lecture"
  const events = []
  const cursor = new Date(params.rangeStart)
  cursor.setHours(0, 0, 0, 0)
  const end = new Date(params.rangeEnd)
  end.setHours(23, 59, 59, 999)

  const earliestFrom = params.versions.reduce(
    (min, version) => (version.effectiveFrom < min ? version.effectiveFrom : min),
    "9999-99-99",
  )

  while (cursor <= end) {
    const version = pickVersionForDate(params.versions, cursor, meetingType)
    let schedule = version?.schedule ?? null
    if (!schedule && params.fallbackSchedule) {
      if (params.versions.length === 0 || toDateKey(cursor) < earliestFrom) {
        schedule = params.fallbackSchedule
      }
    }
    if (schedule) {
      const dayEvents = expandClassMeetingsForRange(
        schedule,
        {
          ...params.context,
          location: version?.location ?? params.fallbackLocation ?? params.context.location,
        },
        cursor,
        cursor,
      )
      events.push(...dayEvents)
    }
    cursor.setDate(cursor.getDate() + 1)
  }

  return events
}

export type MakeupMeeting = {
  missedDate: string
  newDate: string
  startHour: number
  startMinute: number
  endHour: number
  endMinute: number
  location?: string
}

function dateKeyFromIso(iso: string): string {
  const d = new Date(iso)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

export function applyMakeupMeetingsToEvents<
  T extends { start_time: string; end_time: string; location?: string; title: string; description?: string },
>(events: T[], makeups: MakeupMeeting[], title: string): T[] {
  if (makeups.length === 0) return events
  const missed = new Set(makeups.map((m) => m.missedDate))
  const kept = events.filter((e) => !missed.has(dateKeyFromIso(e.start_time)))
  for (const makeup of makeups) {
    const [y, mo, d] = makeup.newDate.split("-").map((n) => Number.parseInt(n, 10))
    kept.push({
      ...(events[0] ?? ({} as T)),
      title: `${title} (makeup)`,
      description: `Makeup class for ${makeup.missedDate}`,
      start_time: formatWallClockIso(y, mo || 1, d || 1, makeup.startHour, makeup.startMinute),
      end_time: formatWallClockIso(y, mo || 1, d || 1, makeup.endHour, makeup.endMinute),
      location: makeup.location ?? events[0]?.location ?? "",
    })
  }
  return kept
}

export function applyCancelledDatesToEvents<T extends { start_time: string }>(
  events: T[],
  cancelledDates: string[],
): T[] {
  if (cancelledDates.length === 0) return events
  const cancelled = new Set(cancelledDates.map((d) => d.slice(0, 10)))
  return events.filter((event) => !cancelled.has(dateKeyFromIso(event.start_time)))
}
