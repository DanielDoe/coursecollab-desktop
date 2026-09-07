export type SyllabusCalendarContext = {
  courseTitle: string
  term: string
  location?: string
}

export type ParsedClassSchedule = {
  dayCodes: string[]
  startHour: number
  startMinute: number
  endHour: number
  endMinute: number
  raw: string
}

const DAY_NAME_TO_CODE: Record<string, string> = {
  sunday: "SU",
  monday: "MO",
  tuesday: "TU",
  wednesday: "WE",
  thursday: "TH",
  friday: "FR",
  saturday: "SA",
}

/** Wall-clock local ISO (no Z) so clients show syllabus hours, not UTC-shifted times. */
export function formatWallClockIso(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): string {
  return `${year}-${pad2(month)}-${pad2(day)}T${pad2(hour)}:${pad2(minute)}:00`
}

const DAY_CODE_TO_JS: Record<string, number> = {
  SU: 0,
  MO: 1,
  TU: 2,
  WE: 3,
  TH: 4,
  FR: 5,
  SA: 6,
}

function pad2(n: number): string {
  return String(n).padStart(2, "0")
}

function parseTime12h(token: string): { hour: number; minute: number } | null {
  const match = token.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i)
  if (!match) return null
  let hour = Number.parseInt(match[1], 10)
  const minute = Number.parseInt(match[2] ?? "0", 10)
  const meridiem = match[3].toUpperCase()
  if (meridiem === "PM" && hour !== 12) hour += 12
  if (meridiem === "AM" && hour === 12) hour = 0
  return { hour, minute }
}

/** Parse strings like "Tuesday, Wednesday, Thursday — 10:00 AM–12:00 PM" or "Tuesday, 1:00 PM – 2:50 PM". */
export function parseCourseMeetingSchedule(text: string): ParsedClassSchedule | null {
  if (!text?.trim()) return null

  const normalized = text.replace(/\u2013|\u2014/g, "-").trim()

  const commaFormat = normalized.match(
    /^(.+?),\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM))\s*-\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM))/i,
  )
  if (commaFormat) {
    const daysPart = commaFormat[1]
    const start = parseTime12h(commaFormat[2])
    const end = parseTime12h(commaFormat[3])
    if (!start || !end) return null
    const dayCodes = daysPart
      .split(/,|\band\b|&/gi)
      .map((d) => d.trim().toLowerCase())
      .map((d) => DAY_NAME_TO_CODE[d])
      .filter(Boolean) as string[]
    if (!dayCodes.length) return null
    return {
      dayCodes,
      startHour: start.hour,
      startMinute: start.minute,
      endHour: end.hour,
      endMinute: end.minute,
      raw: text,
    }
  }

  const split = normalized.split(/\s+-\s+|\s+—\s+/)
  if (split.length < 2) return null

  const daysPart = split[0]
  const timePart = split.slice(1).join(" - ")
  const timeMatch = timePart.match(
    /(\d{1,2}(?::\d{2})?\s*(?:AM|PM))\s*[-–—]\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM))/i,
  )
  if (!timeMatch) return null

  const start = parseTime12h(timeMatch[1])
  const end = parseTime12h(timeMatch[2])
  if (!start || !end) return null

  const dayCodes = daysPart
    .split(/,|\band\b|&/gi)
    .map((d) => d.trim().toLowerCase())
    .map((d) => DAY_NAME_TO_CODE[d])
    .filter(Boolean) as string[]

  if (!dayCodes.length) return null

  return {
    dayCodes,
    startHour: start.hour,
    startMinute: start.minute,
    endHour: end.hour,
    endMinute: end.minute,
    raw: text,
  }
}

function inferTermBounds(term: string): { start: Date; end: Date } {
  const match = term.match(/(spring|summer|fall|winter)\s*(\d{4})/i)
  const season = match?.[1]?.toLowerCase() ?? "fall"
  const year = Number.parseInt(match?.[2] ?? String(new Date().getFullYear()), 10)

  switch (season) {
    case "spring":
      return { start: new Date(year, 0, 15), end: new Date(year, 4, 15) }
    case "summer":
      return { start: new Date(year, 5, 1), end: new Date(year, 7, 4) }
    case "winter":
      return { start: new Date(year, 0, 2), end: new Date(year, 0, 31) }
    default:
      return { start: new Date(year, 7, 20), end: new Date(year, 11, 15) }
  }
}

function firstOccurrenceOnOrAfter(dayCode: string, onOrAfter: Date): Date {
  const target = DAY_CODE_TO_JS[dayCode] ?? 1
  const date = new Date(onOrAfter)
  date.setHours(0, 0, 0, 0)
  for (let i = 0; i < 14; i++) {
    if (date.getDay() === target) return date
    date.setDate(date.getDate() + 1)
  }
  return onOrAfter
}

function earliestClassStart(schedule: ParsedClassSchedule, termStart: Date): Date {
  const candidates = schedule.dayCodes.map((code) => firstOccurrenceOnOrAfter(code, termStart))
  return candidates.sort((a, b) => a.getTime() - b.getTime())[0]
}

function formatIcsUtc(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")
}

function formatGoogleDate(date: Date): string {
  return `${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}T${pad2(date.getHours())}${pad2(date.getMinutes())}00`
}

function escapeIcsText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n")
}

export function buildClassScheduleEvent(
  schedule: ParsedClassSchedule,
  context: SyllabusCalendarContext,
): {
  title: string
  location: string
  description: string
  start: Date
  end: Date
  until: Date
  rrule: string
} | null {
  const { start: termStart, end: termEnd } = inferTermBounds(context.term)
  const firstDay = earliestClassStart(schedule, termStart)

  const start = new Date(firstDay)
  start.setHours(schedule.startHour, schedule.startMinute, 0, 0)

  const end = new Date(firstDay)
  end.setHours(schedule.endHour, schedule.endMinute, 0, 0)

  const until = new Date(termEnd)
  until.setHours(23, 59, 59, 0)

  const title = context.courseTitle || "Course class meeting"
  const location = context.location?.trim() || ""
  const description = `Recurring class schedule: ${schedule.raw}`

  return {
    title,
    location,
    description,
    start,
    end,
    until,
    rrule: `FREQ=WEEKLY;BYDAY=${schedule.dayCodes.join(",")};UNTIL=${formatIcsUtc(until)}`,
  }
}

export function buildClassScheduleIcs(
  schedule: ParsedClassSchedule,
  context: SyllabusCalendarContext,
): string | null {
  const event = buildClassScheduleEvent(schedule, context)
  if (!event) return null

  const dtStart = `DTSTART;TZID=America/Chicago:${event.start.getFullYear()}${pad2(event.start.getMonth() + 1)}${pad2(event.start.getDate())}T${pad2(event.start.getHours())}${pad2(event.start.getMinutes())}00`
  const dtEnd = `DTEND;TZID=America/Chicago:${event.end.getFullYear()}${pad2(event.end.getMonth() + 1)}${pad2(event.end.getDate())}T${pad2(event.end.getHours())}${pad2(event.end.getMinutes())}00`

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CourseCollab//Syllabus//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VTIMEZONE",
    "TZID:America/Chicago",
    "BEGIN:STANDARD",
    "DTSTART:19701101T020000",
    "TZOFFSETFROM:-0500",
    "TZOFFSETTO:-0600",
    "END:STANDARD",
    "BEGIN:DAYLIGHT",
    "DTSTART:19700308T020000",
    "TZOFFSETFROM:-0600",
    "TZOFFSETTO:-0500",
    "END:DAYLIGHT",
    "END:VTIMEZONE",
    "BEGIN:VEVENT",
    `UID:class-${Date.now()}@coursecollab`,
    dtStart,
    dtEnd,
    `RRULE:${event.rrule}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
    event.location ? `LOCATION:${escapeIcsText(event.location)}` : "",
    `DESCRIPTION:${escapeIcsText(event.description)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n")
}

export function googleCalendarUrlForClass(
  schedule: ParsedClassSchedule,
  context: SyllabusCalendarContext,
): string | null {
  const event = buildClassScheduleEvent(schedule, context)
  if (!event) return null

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${formatGoogleDate(event.start)}/${formatGoogleDate(event.end)}`,
    recur: `RRULE:${event.rrule}`,
    details: event.description,
  })
  if (event.location) params.set("location", event.location)
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

export function outlookCalendarUrlForClass(
  schedule: ParsedClassSchedule,
  context: SyllabusCalendarContext,
): string | null {
  const event = buildClassScheduleEvent(schedule, context)
  if (!event) return null

  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: event.title,
    startdt: event.start.toISOString(),
    enddt: event.end.toISOString(),
    body: `${event.description}\n\n(Recurring weekly on ${schedule.dayCodes.join(", ")} through ${context.term} — open the downloaded .ics file for full recurrence in Outlook desktop.)`,
  })
  if (event.location) params.set("location", event.location)
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`
}

export function office365CalendarUrlForClass(
  schedule: ParsedClassSchedule,
  context: SyllabusCalendarContext,
): string | null {
  const event = buildClassScheduleEvent(schedule, context)
  if (!event) return null

  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: event.title,
    startdt: event.start.toISOString(),
    enddt: event.end.toISOString(),
    body: `${event.description}\n\n(Recurring weekly — use Download .ics for full recurrence in Outlook.)`,
  })
  if (event.location) params.set("location", event.location)
  return `https://outlook.office.com/calendar/0/deeplink/compose?${params.toString()}`
}

export type ClassMeetingCalendarEvent = {
  id: number
  title: string
  description: string
  event_type: "class_meeting"
  start_time: string
  end_time: string
  all_day: boolean
  location: string
  color: string
  is_completed: boolean
  reminder_minutes: number
  isClassMeeting: true
}

/** Expand recurring class meetings into individual instances for a date range. */
export function expandClassMeetingsForRange(
  schedule: ParsedClassSchedule,
  context: SyllabusCalendarContext,
  rangeStart: Date,
  rangeEnd: Date,
): ClassMeetingCalendarEvent[] {
  const title = context.courseTitle || "Class meeting"
  const location = context.location?.trim() || ""
  const description = `Recurring class schedule: ${schedule.raw}`
  const targetDays = new Set(schedule.dayCodes.map((code) => DAY_CODE_TO_JS[code]))

  const start = new Date(rangeStart)
  start.setHours(0, 0, 0, 0)
  const end = new Date(rangeEnd)
  end.setHours(23, 59, 59, 999)

  const events: ClassMeetingCalendarEvent[] = []
  const cursor = new Date(start)

  while (cursor <= end) {
    if (targetDays.has(cursor.getDay())) {
      const y = cursor.getFullYear()
      const m = cursor.getMonth() + 1
      const d = cursor.getDate()
      const virtualId = -Number.parseInt(`${y}${String(m).padStart(2, "0")}${String(d).padStart(2, "0")}`, 10)

      events.push({
        id: virtualId,
        title,
        description,
        event_type: "class_meeting",
        start_time: formatWallClockIso(y, m, d, schedule.startHour, schedule.startMinute),
        end_time: formatWallClockIso(y, m, d, schedule.endHour, schedule.endMinute),
        all_day: false,
        location,
        color: "#0284c7",
        is_completed: false,
        reminder_minutes: 15,
        isClassMeeting: true,
      })
    }
    cursor.setDate(cursor.getDate() + 1)
  }

  return events
}

export function downloadIcsFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

/** Single all-day or timed deadline (academic calendar / exam row). */
export function parseSyllabusDate(dateText: string): Date | null {
  const parsed = Date.parse(dateText.replace(/,/g, ""))
  if (Number.isNaN(parsed)) return null
  return new Date(parsed)
}

export function buildDeadlineIcs(
  title: string,
  dateText: string,
  description: string,
  context: SyllabusCalendarContext,
): string | null {
  const date = parseSyllabusDate(dateText)
  if (!date) return null

  const start = new Date(date)
  start.setHours(9, 0, 0, 0)
  const end = new Date(date)
  end.setHours(10, 0, 0, 0)

  const summary = `${context.courseTitle}: ${title}`

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CourseCollab//Syllabus//EN",
    "BEGIN:VEVENT",
    `UID:deadline-${start.getTime()}@coursecollab`,
    `DTSTART;TZID=America/Chicago:${start.getFullYear()}${pad2(start.getMonth() + 1)}${pad2(start.getDate())}T090000`,
    `DTEND;TZID=America/Chicago:${end.getFullYear()}${pad2(end.getMonth() + 1)}${pad2(end.getDate())}T100000`,
    `SUMMARY:${escapeIcsText(summary)}`,
    `DESCRIPTION:${escapeIcsText(description)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n")
}

export function googleCalendarUrlForDeadline(
  title: string,
  dateText: string,
  description: string,
  context: SyllabusCalendarContext,
): string | null {
  const date = parseSyllabusDate(dateText)
  if (!date) return null
  const start = new Date(date)
  start.setHours(9, 0, 0, 0)
  const end = new Date(date)
  end.setHours(10, 0, 0, 0)
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `${context.courseTitle}: ${title}`,
    dates: `${formatGoogleDate(start)}/${formatGoogleDate(end)}`,
    details: description,
  })
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

export function outlookCalendarUrlForDeadline(
  title: string,
  dateText: string,
  description: string,
  context: SyllabusCalendarContext,
): string | null {
  const date = parseSyllabusDate(dateText)
  if (!date) return null
  const start = new Date(date)
  start.setHours(9, 0, 0, 0)
  const end = new Date(date)
  end.setHours(10, 0, 0, 0)
  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: `${context.courseTitle}: ${title}`,
    startdt: start.toISOString(),
    enddt: end.toISOString(),
    body: description,
  })
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`
}
