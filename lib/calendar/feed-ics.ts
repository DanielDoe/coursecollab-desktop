export type CalendarFeedEvent = {
  uid: string
  title: string
  startTime: string
  endTime: string
  location?: string | null
  description?: string | null
  lastModified?: string | null
}

function pad2(value: number) {
  return String(value).padStart(2, "0")
}

function icsLocal(iso: string): string | null {
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/)
  if (!match) return null
  return `${match[1]}${match[2]}${match[3]}T${match[4]}${match[5]}00`
}

function escapeIcs(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;")
}

function stampNow(): string {
  const now = new Date()
  return `${now.getUTCFullYear()}${pad2(now.getUTCMonth() + 1)}${pad2(now.getUTCDate())}T${pad2(now.getUTCHours())}${pad2(now.getUTCMinutes())}${pad2(now.getUTCSeconds())}Z`
}

function icsUtc(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return stampNow()
  return `${date.getUTCFullYear()}${pad2(date.getUTCMonth() + 1)}${pad2(date.getUTCDate())}T${pad2(date.getUTCHours())}${pad2(date.getUTCMinutes())}${pad2(date.getUTCSeconds())}Z`
}

function sequenceFor(event: CalendarFeedEvent): number {
  const source = event.lastModified?.trim()
  if (source) {
    const ms = new Date(source).getTime()
    if (!Number.isNaN(ms)) return Math.max(1, Math.floor(ms / 1000))
  }
  const start = Date.parse(event.startTime)
  return Number.isNaN(start) ? 1 : Math.max(1, Math.floor(start / 1000))
}

function alarms(beforeMinutes: number, atStart: boolean): string[] {
  const lines: string[] = []
  if (beforeMinutes > 0) {
    lines.push(
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      "DESCRIPTION:Class starting soon",
      `TRIGGER:-PT${beforeMinutes}M`,
      "END:VALARM",
    )
  }
  if (atStart) {
    lines.push(
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      "DESCRIPTION:Class starting now",
      "TRIGGER:PT0S",
      "END:VALARM",
    )
  }
  return lines
}

export function buildClassCalendarIcs(params: {
  calendarName: string
  events: CalendarFeedEvent[]
  beforeMinutes: number
  atStart: boolean
}): string {
  const dtstamp = stampNow()
  const blocks = params.events.flatMap((event) => {
    const start = icsLocal(event.startTime)
    const end = icsLocal(event.endTime) ?? start
    if (!start || !end) return []
    return [
      "BEGIN:VEVENT",
      `UID:${escapeIcs(event.uid)}`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART;TZID=America/Chicago:${start}`,
      `DTEND;TZID=America/Chicago:${end}`,
      `LAST-MODIFIED:${icsUtc(event.lastModified || event.startTime)}`,
      `SEQUENCE:${sequenceFor(event)}`,
      `SUMMARY:${escapeIcs(event.title)}`,
      event.location ? `LOCATION:${escapeIcs(event.location)}` : "",
      event.description ? `DESCRIPTION:${escapeIcs(event.description)}` : "",
      ...alarms(params.beforeMinutes, params.atStart),
      "END:VEVENT",
    ].filter(Boolean)
  })

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CourseCollab//Class Schedule//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "REFRESH-INTERVAL;VALUE=DURATION:PT15M",
    "X-PUBLISHED-TTL:PT15M",
    `X-WR-CALNAME:${escapeIcs(params.calendarName)}`,
    "X-WR-TIMEZONE:America/Chicago",
    ...blocks,
    "END:VCALENDAR",
    "",
  ].join("\r\n")
}

export function calendarFeedHttpHeaders() {
  return {
    "Content-Type": "text/calendar; charset=utf-8",
    "Content-Disposition": "inline; filename=coursecollab-classes.ics",
    "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0",
    Pragma: "no-cache",
    Expires: "0",
  }
}
