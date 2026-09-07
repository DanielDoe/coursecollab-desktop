import type { ScheduleAdjustmentRequestRow } from "@/lib/schedule-adjustment/types"
import { DAY_CODE_LABELS, formatTime12h, type DayCode } from "@/lib/schedule-adjustment/time-slots"

export type MeetingWindow = {
  day: string
  startTime: string
  endTime: string
}

export type DualArrangement = {
  instructorLed: MeetingWindow
  structured: MeetingWindow
  effectiveDate: string
}

export function normalizeTime(value: unknown): string {
  const raw = String(value ?? "").trim()
  if (/^\d{2}:\d{2}:\d{2}/.test(raw)) return raw.slice(0, 8)
  if (/^\d{2}:\d{2}$/.test(raw)) return `${raw}:00`
  return raw
}

function toDateOnly(value: unknown): string | null {
  if (value == null) return null
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null
    const year = value.getFullYear()
    const month = String(value.getMonth() + 1).padStart(2, "0")
    const day = String(value.getDate()).padStart(2, "0")
    return `${year}-${month}-${day}`
  }
  const text = String(value).trim()
  if (!text) return null
  const iso = text.match(/^\d{4}-\d{2}-\d{2}/)
  if (iso) return iso[0]
  const parsed = new Date(text)
  return Number.isNaN(parsed.getTime()) ? null : toDateOnly(parsed)
}

export function formatMeetingWindow(window: MeetingWindow | null | undefined): string {
  if (!window?.day || !window.startTime || !window.endTime) return "Not set"
  const day = DAY_CODE_LABELS[window.day as DayCode] ?? window.day
  return `${day} ${formatTime12h(normalizeTime(window.startTime))} to ${formatTime12h(normalizeTime(window.endTime))}`
}

export function arrangementFromRequest(request: ScheduleAdjustmentRequestRow): DualArrangement | null {
  const instructorLed = {
    day: String(request.instructor_led_day ?? "").trim(),
    startTime: normalizeTime(request.instructor_led_start_time),
    endTime: normalizeTime(request.instructor_led_end_time),
  }
  const structured = {
    day: String(request.structured_session_day ?? "").trim(),
    startTime: normalizeTime(request.structured_session_start_time),
    endTime: normalizeTime(request.structured_session_end_time),
  }
  const effectiveDate = toDateOnly(request.effective_date)
  if (!instructorLed.day || !instructorLed.startTime || !instructorLed.endTime) return null
  if (!structured.day || !structured.startTime || !structured.endTime) return null
  if (!effectiveDate) return null
  return { instructorLed, structured, effectiveDate }
}

export function formatOriginalSchedules(request: ScheduleAdjustmentRequestRow): string {
  const lecture = request.original_schedules?.lecture?.scheduleText?.trim()
  const lab = request.original_schedules?.laboratory?.scheduleText?.trim()
  const parts: string[] = []
  if (lecture) parts.push(`Lecture: ${lecture}`)
  if (lab) parts.push(`Laboratory: ${lab}`)
  return parts.join("\n") || "See course syllabus"
}

export function formatProposedArrangement(request: ScheduleAdjustmentRequestRow): string {
  const arrangement = arrangementFromRequest(request)
  if (!arrangement) {
    if (request.proposed_day && request.proposed_start_time && request.proposed_end_time) {
      return formatMeetingWindow({
        day: request.proposed_day,
        startTime: request.proposed_start_time,
        endTime: request.proposed_end_time,
      })
    }
    return "Proposed schedule not set"
  }
  return [
    `Instructor Led Session: ${formatMeetingWindow(arrangement.instructorLed)}`,
    `Structured CourseCollab Session: ${formatMeetingWindow(arrangement.structured)}`,
  ].join("\n")
}

export function proposedArrangementStored(request: ScheduleAdjustmentRequestRow) {
  const arrangement = arrangementFromRequest(request)
  if (!arrangement) return null
  return {
    instructorLed: {
      label: "Instructor Led Session",
      day: arrangement.instructorLed.day,
      startTime: arrangement.instructorLed.startTime,
      endTime: arrangement.instructorLed.endTime,
      scheduleText: formatMeetingWindow(arrangement.instructorLed),
    },
    structured: {
      label: "Structured CourseCollab Session",
      day: arrangement.structured.day,
      startTime: arrangement.structured.startTime,
      endTime: arrangement.structured.endTime,
      scheduleText: formatMeetingWindow(arrangement.structured),
    },
    effectiveDate: arrangement.effectiveDate,
  }
}

export function validateDualArrangement(input: {
  instructorLedDay?: string | null
  instructorLedStartTime?: string | null
  instructorLedEndTime?: string | null
  structuredSessionDay?: string | null
  structuredSessionStartTime?: string | null
  structuredSessionEndTime?: string | null
  effectiveDate?: string | null
}): string | null {
  if (!input.instructorLedDay || !input.instructorLedStartTime || !input.instructorLedEndTime) {
    return "Instructor led meeting day and times are required"
  }
  if (!input.structuredSessionDay || !input.structuredSessionStartTime || !input.structuredSessionEndTime) {
    return "Structured CourseCollab session day and times are required"
  }
  if (!input.effectiveDate || !/^\d{4}-\d{2}-\d{2}$/.test(input.effectiveDate)) {
    return "Effective date is required"
  }
  return null
}

export const STRUCTURED_SESSION_CALENDAR_DESCRIPTION = [
  "Structured CourseCollab Session",
  "Attendance check in required",
  "Open CourseCollab during the scheduled session",
  "Complete assigned course activities",
].join("\n")

export const DEFAULT_STRUCTURED_LATE_MINUTES = 20
