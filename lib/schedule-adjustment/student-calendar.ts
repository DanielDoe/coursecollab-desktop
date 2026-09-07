import { DAY_CODE_LABELS, DAY_CODES, formatTime12h, parseTimeToMinutes, type DayCode } from "@/lib/schedule-adjustment/time-slots"
import type { OriginalSchedulesPayload } from "@/lib/schedule-adjustment/types"
import type { ParsedClassSchedule } from "@/lib/syllabus/calendar-export"

export function originalScheduleText(
  original: OriginalSchedulesPayload | null | undefined,
  meetingType?: string,
): string {
  const key = meetingType === "laboratory" ? "laboratory" : "lecture"
  return original?.[key]?.scheduleText ?? original?.lecture?.scheduleText ?? "See course syllabus"
}

export function proposedDayLabel(day: string | null | undefined): string {
  if (!day) return "TBD"
  if ((DAY_CODES as readonly string[]).includes(day)) return DAY_CODE_LABELS[day as DayCode]
  if (/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    return new Date(`${day}T12:00:00`).toLocaleDateString(undefined, {
      weekday: "long",
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }
  return day
}

export function formatLongDate(value: string | Date | null | undefined): string {
  if (!value) return "TBD"
  const raw = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : String(value)
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric", year: "numeric" })
}

export function proposedScheduleLabel(params: {
  day?: string | null
  start?: string | null
  end?: string | null
}): string {
  if (!params.day || !params.start || !params.end) return "Not set yet"
  return `${proposedDayLabel(params.day)}, ${formatTime12h(params.start)} – ${formatTime12h(params.end)}`
}

export function proposedToClassSchedule(params: {
  day?: string | null
  start?: string | null
  end?: string | null
}): ParsedClassSchedule | null {
  if (!params.day || !params.start || !params.end) return null
  const dayCode = (DAY_CODES as readonly string[]).includes(params.day) ? params.day : null
  if (!dayCode) return null
  const startM = parseTimeToMinutes(params.start)
  const endM = parseTimeToMinutes(params.end)
  return {
    dayCodes: [dayCode],
    startHour: Math.floor(startM / 60),
    startMinute: startM % 60,
    endHour: Math.floor(endM / 60),
    endMinute: endM % 60,
    raw: proposedScheduleLabel(params),
  }
}

function pad2(n: number) {
  return String(n).padStart(2, "0")
}

function icsStamp(d: Date) {
  return `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}T${pad2(d.getUTCHours())}${pad2(d.getUTCMinutes())}00Z`
}

function googleStamp(d: Date) {
  return icsStamp(d)
}

function escapeIcs(text: string) {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n")
}

export function buildTimedEventIcs(params: {
  title: string
  start: Date
  end: Date
  description: string
  location?: string
}): string {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CourseCollab//Schedule Adjustment//EN",
    "BEGIN:VEVENT",
    `UID:sa-${params.start.getTime()}@coursecollab`,
    `DTSTART:${icsStamp(params.start)}`,
    `DTEND:${icsStamp(params.end)}`,
    `SUMMARY:${escapeIcs(params.title)}`,
    params.location ? `LOCATION:${escapeIcs(params.location)}` : "",
    `DESCRIPTION:${escapeIcs(params.description)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n")
}

export function googleCalendarUrlForTimedEvent(params: {
  title: string
  start: Date
  end: Date
  description: string
  location?: string
}): string {
  const query = new URLSearchParams({
    action: "TEMPLATE",
    text: params.title,
    dates: `${googleStamp(params.start)}/${googleStamp(params.end)}`,
    details: params.description,
  })
  if (params.location) query.set("location", params.location)
  return `https://calendar.google.com/calendar/render?${query.toString()}`
}

export function outlookCalendarUrlForTimedEvent(params: {
  title: string
  start: Date
  end: Date
  description: string
  location?: string
}): string {
  const query = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: params.title,
    startdt: params.start.toISOString(),
    enddt: params.end.toISOString(),
    body: params.description,
  })
  if (params.location) query.set("location", params.location)
  return `https://outlook.live.com/calendar/0/deeplink/compose?${query.toString()}`
}

export function resolveEventStartEnd(params: {
  day?: string | null
  date?: string | null
  start?: string | null
  end?: string | null
  effectiveDate?: string | null
}): { start: Date; end: Date } | null {
  if (!params.start || !params.end) return null
  const dateStr =
    params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date)
      ? params.date
      : params.effectiveDate && /^\d{4}-\d{2}-\d{2}$/.test(params.effectiveDate)
        ? params.effectiveDate
        : params.day && /^\d{4}-\d{2}-\d{2}$/.test(params.day)
          ? params.day
          : null
  if (!dateStr) return null
  const startM = parseTimeToMinutes(params.start)
  const endM = parseTimeToMinutes(params.end)
  const start = new Date(`${dateStr}T00:00:00`)
  start.setHours(Math.floor(startM / 60), startM % 60, 0, 0)
  const end = new Date(`${dateStr}T00:00:00`)
  end.setHours(Math.floor(endM / 60), endM % 60, 0, 0)
  return { start, end }
}
