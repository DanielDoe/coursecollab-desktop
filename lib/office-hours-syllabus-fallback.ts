import { getSyllabusByCourseId } from "@/lib/syllabus/syllabus-service"

export type ParsedOfficeHourSlot = {
  dayOfWeek: number
  dayName: string
  startTime: string
  endTime: string
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

const DAY_NAME_TO_NUM: Record<string, number> = {
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  tues: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  thur: 4,
  thurs: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
}

export type SyllabusInstructorContact = {
  email: string | null
  phone: string | null
  department: string | null
  officeBuilding: string | null
  officeRoom: string | null
  officeLocation: string | null
  onDemandSupport: string | null
  additionalMeetingHours: string | null
}

export function syllabusFieldValue(fields: Record<string, string>, pattern: RegExp): string | null {
  for (const [key, raw] of Object.entries(fields)) {
    const value = String(raw ?? "").trim()
    if (!value || value.startsWith("[")) continue
    if (pattern.test(key.trim())) return value
  }
  return null
}

function to24HourTime(raw: string, inheritedMeridiem?: string): string | null {
  const text = raw.trim()
  const match = text.match(/^(\d{1,2})(?::(\d{2}))?\s*([AP]M)?$/i)
  if (!match) return text.includes(":") ? text.slice(0, 5) : null
  let hour = Number.parseInt(match[1]!, 10)
  const minute = match[2] ?? "00"
  const meridiem = (match[3] || inheritedMeridiem || "").toUpperCase()
  if (meridiem === "PM" && hour !== 12) hour += 12
  if (meridiem === "AM" && hour === 12) hour = 0
  if (!Number.isFinite(hour) || hour < 0 || hour > 23) return null
  return `${String(hour).padStart(2, "0")}:${minute}`
}

function dayFromName(name: string): number | null {
  return DAY_NAME_TO_NUM[name.trim().toLowerCase()] ?? null
}

const COMPACT_DAY_MAP: Record<string, number> = { U: 0, M: 1, T: 2, W: 3, R: 4, F: 5, S: 6 }

function daysFromCompactCodes(token: string): number[] {
  const compact = token.trim().toUpperCase()
  if (!/^[UMTWRFS]{2,5}$/.test(compact)) return []
  const days: number[] = []
  for (const letter of compact) {
    const day = COMPACT_DAY_MAP[letter]
    if (day == null) return []
    if (!days.includes(day)) days.push(day)
  }
  return days
}

function daysFromText(text: string): number[] {
  const withoutMeridiem = text.replace(/\b[AP]M\b/gi, " ")
  const leading = withoutMeridiem.trim().split(/\s+/)[0] ?? ""
  const compact = daysFromCompactCodes(leading.replace(/[^A-Za-z]/g, ""))
  if (compact.length > 0 && !/\b(mon|tue|wed|thu|fri|sat|sun)/i.test(text)) {
    return compact
  }
  const days: number[] = []
  const matches = text.matchAll(/\b(sundays?|sun|mondays?|mon|tuesdays?|tues?|wednesdays?|wed|thursdays?|thurs?|thu|fridays?|fri|saturdays?|sat)\b/gi)
  for (const match of matches) {
    const day = dayFromName(match[1]!.replace(/s$/i, ""))
    if (day != null && !days.includes(day)) days.push(day)
  }
  if (days.length === 0) {
    return daysFromCompactCodes(withoutMeridiem.replace(/[^A-Za-z]/g, ""))
  }
  return days
}

function parseTimeRange(text: string): { startTime: string; endTime: string } | null {
  const match = text.match(
    /(\d{1,2}(?::\d{2})?)\s*([AP]M)?\s*[–—-]\s*(\d{1,2}(?::\d{2})?)\s*([AP]M)?/i,
  )
  if (!match) return null
  const endMeridiem = match[4] || match[2]
  const startMeridiem = match[2] || match[4]
  const startTime = to24HourTime(match[1]!, startMeridiem)
  const endTime = to24HourTime(match[3]!, endMeridiem)
  if (!startTime || !endTime) return null
  if (!startMeridiem && !endMeridiem) {
    const startHour = Number.parseInt(startTime.slice(0, 2), 10)
    const endHour = Number.parseInt(endTime.slice(0, 2), 10)
    if (endHour <= startHour && endHour < 12) {
      return {
        startTime,
        endTime: `${String(endHour + 12).padStart(2, "0")}:${endTime.slice(3)}`,
      }
    }
  }
  return { startTime, endTime }
}

function slotsFromDaysAndRange(days: number[], range: { startTime: string; endTime: string }): ParsedOfficeHourSlot[] {
  return days.map((day) => ({
    dayOfWeek: day,
    dayName: DAY_NAMES[day] ?? "Day",
    startTime: range.startTime,
    endTime: range.endTime,
  }))
}

export function parseSyllabusOfficeHoursLine(line: string): ParsedOfficeHourSlot | null {
  return parseSyllabusOfficeHoursText(line)[0] ?? null
}

export function parseSyllabusOfficeHoursText(text: string | null | undefined): ParsedOfficeHourSlot[] {
  if (!text?.trim()) return []
  const chunks = text
    .split(/\n|;(?=\s*[A-Za-z0-9])/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
  const slots: ParsedOfficeHourSlot[] = []
  const seen = new Set<string>()
  const add = (next: ParsedOfficeHourSlot[]) => {
    for (const slot of next) {
      const key = `${slot.dayOfWeek}:${slot.startTime}:${slot.endTime}`
      if (seen.has(key)) continue
      seen.add(key)
      slots.push(slot)
    }
  }
  for (const chunk of chunks) {
    const range = parseTimeRange(chunk)
    const days = daysFromText(chunk)
    if (range && days.length > 0) {
      add(slotsFromDaysAndRange(days, range))
      continue
    }
    const simple = chunk.match(
      /^([A-Za-z]+s?),?\s+(\d{1,2}:\d{2}(?:\s*[AP]M)?)\s*[–—-]\s*(\d{1,2}:\d{2}(?:\s*[AP]M)?)/i,
    )
    if (simple) {
      const day = dayFromName(simple[1]!.replace(/s$/i, ""))
      const parsedRange = parseTimeRange(`${simple[2]} - ${simple[3]}`)
      if (day != null && parsedRange) add(slotsFromDaysAndRange([day], parsedRange))
    }
  }
  if (slots.length === 0) {
    const range = parseTimeRange(text)
    const days = daysFromText(text)
    if (range && days.length > 0) add(slotsFromDaysAndRange(days, range))
  }
  return slots
}

export function parseOfficeLocationText(text: string | null | undefined): {
  building: string | null
  room: string | null
  full: string | null
} {
  const full = String(text ?? "").trim()
  if (!full) return { building: null, room: null, full: null }
  const match = full.match(/^(.+?)\s+(\d+[A-Za-z]?)\s*(?:;\s*(.*))?$/i)
  if (!match) return { building: null, room: null, full }
  return {
    building: match[1]?.trim() || null,
    room: match[2]?.trim() || null,
    full,
  }
}

export function contactFromSyllabusFields(fields: Record<string, string>): SyllabusInstructorContact {
  const officeLocation = syllabusFieldValue(fields, /office location/i)
  const parsedLocation = parseOfficeLocationText(officeLocation)
  return {
    email: syllabusFieldValue(fields, /^email$/i),
    phone: syllabusFieldValue(fields, /phone/i),
    department: syllabusFieldValue(fields, /department/i),
    officeBuilding: parsedLocation.building,
    officeRoom: parsedLocation.room,
    officeLocation,
    onDemandSupport: syllabusFieldValue(fields, /on-?demand/i),
    additionalMeetingHours: syllabusFieldValue(fields, /additional.*hours|research.*hours/i),
  }
}

export function mergeSyllabusContact(
  base: SyllabusInstructorContact,
  patch: SyllabusInstructorContact,
): SyllabusInstructorContact {
  return {
    email: base.email ?? patch.email,
    phone: base.phone ?? patch.phone,
    department: base.department ?? patch.department,
    officeBuilding: base.officeBuilding ?? patch.officeBuilding,
    officeRoom: base.officeRoom ?? patch.officeRoom,
    officeLocation: base.officeLocation ?? patch.officeLocation,
    onDemandSupport: base.onDemandSupport ?? patch.onDemandSupport,
    additionalMeetingHours: base.additionalMeetingHours ?? patch.additionalMeetingHours,
  }
}

export async function getPublishedSyllabusInstructorFields(
  courseId: number,
  sessionId: number | null,
): Promise<Record<string, string>> {
  const scoped = await getSyllabusByCourseId(courseId, sessionId)
  if (scoped?.status === "published") {
    const section = scoped.sections.find((s) => s.sectionId === "instructor-info")
    if (section?.content?.fields) return section.content.fields
  }

  if (sessionId != null) {
    const courseLevel = await getSyllabusByCourseId(courseId, null)
    if (courseLevel?.status === "published") {
      const section = courseLevel.sections.find((s) => s.sectionId === "instructor-info")
      if (section?.content?.fields) return section.content.fields
    }
  }

  return {}
}

export async function loadSyllabusOfficeHoursForOffering(
  courseId: number,
  sessionId: number | null,
): Promise<{
  slots: ParsedOfficeHourSlot[]
  syllabusHoursSummary: string | null
  supplementaryNotes: string[]
  officeLocation: string | null
}> {
  const fields = await getPublishedSyllabusInstructorFields(courseId, sessionId)
  const hoursText = syllabusFieldValue(fields, /^office hours$/i) ?? syllabusFieldValue(fields, /office hours/i)
  const extraText = syllabusFieldValue(fields, /additional.*hours|research.*hours/i)
  const slots = parseSyllabusOfficeHoursText(hoursText)
  const location = syllabusFieldValue(fields, /office location/i)
  return {
    slots,
    syllabusHoursSummary: hoursText,
    supplementaryNotes: extraText?.trim() ? [extraText.trim()] : [],
    officeLocation: location,
  }
}
