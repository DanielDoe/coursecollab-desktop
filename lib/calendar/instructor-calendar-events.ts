export const INSTRUCTOR_CALENDAR_INVALIDATE_EVENT = "instructor-calendar-invalidate"

export function notifyInstructorCalendarChanged() {
  if (typeof window === "undefined") return
  window.dispatchEvent(new Event(INSTRUCTOR_CALENDAR_INVALIDATE_EVENT))
}

export type InstructorCalendarEventType =
  | "class_meeting"
  | "regular_office_hours"
  | "booked_office_hours"

export type InstructorCalendarView = "all" | "selected"

export type InstructorCalendarEvent = {
  id: string
  title: string
  description: string
  eventType: InstructorCalendarEventType
  startTime: string
  endTime: string
  location: string
  color: string
  pendingScheduleChange: boolean
  meetingType?: string
  scheduleAdjustmentId?: number | null
  studentName?: string
  topic?: string
  officeHoursRequestId?: number
  href?: string
  lastModified?: string
  courseId?: number
  sessionId?: number | null
  courseCode?: string
  courseTitle?: string
  sessionCode?: string | null
}

export type InstructorCalendarAdjustment = {
  id: number
  status: string
  meetingType: string
  reason: string
  courseId?: number
  courseCode?: string
  sessionCode?: string | null
}

export type InstructorCalendarScheduleSummary = {
  courseId: number
  sessionId: number | null
  courseCode: string
  courseTitle: string
  sessionCode: string | null
  scheduleText: string | null
  location: string | null
}

export type InstructorCalendarPayload = {
  events: InstructorCalendarEvent[]
  scheduleText: string | null
  location: string | null
  openAdjustments: InstructorCalendarAdjustment[]
  calendarScope?: InstructorCalendarView
  scheduleSummaries?: InstructorCalendarScheduleSummary[]
}

export function instructorEventCourseLabel(event: {
  sessionCode?: string | null
  courseCode?: string
}): string | null {
  const label = event.sessionCode?.trim() || event.courseCode?.trim()
  return label || null
}
