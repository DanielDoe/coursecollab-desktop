import { sql } from "@/lib/db"
import { buildStudentClassMeetingEventsForRange } from "@/lib/calendar/student-class-meetings"
import { buildRegularOfficeHourOccurrences } from "@/lib/calendar/regular-office-hours"
import { ensureOfficeHoursCourseScopeColumns, hasOfficeHourRequestsCourseIdColumn, buildOfficeHourRequestCourseScopeSqlFragment, buildOfficeHourStudentInCourseSqlFragment } from "@/lib/office-hours-course-scope"
import { expandClassMeetingsForRange } from "@/lib/syllabus/calendar-export"
import { getEffectiveCourseMeetingSchedules } from "@/lib/schedule-adjustment/schedule-source"
import { listCourseRequests } from "@/lib/schedule-adjustment/workflow-service"
import { ensureScheduleAdjustmentSchema } from "@/lib/ensure-schedule-adjustment-schema"
import type { ScheduleAdjustmentStatus } from "@/lib/schedule-adjustment/types"
import type { FacultyCourseOffering } from "@/lib/faculty-course-offerings-shared"
import type {
  InstructorCalendarAdjustment,
  InstructorCalendarEvent,
  InstructorCalendarPayload,
  InstructorCalendarScheduleSummary,
} from "@/lib/calendar/instructor-calendar-events"

export type {
  InstructorCalendarAdjustment,
  InstructorCalendarEvent,
  InstructorCalendarEventType,
  InstructorCalendarPayload,
  InstructorCalendarScheduleSummary,
  InstructorCalendarView,
} from "@/lib/calendar/instructor-calendar-events"

export type InstructorCalendarOfferingLabel = {
  courseId: number
  sessionId: number | null
  courseCode: string
  courseTitle: string
  sessionCode: string | null
}

const MAX_ALL_COURSE_OFFERINGS = 16
const ALL_COURSE_BATCH = 4

const OPEN_ADJUSTMENT_STATUSES = new Set<ScheduleAdjustmentStatus>([
  "DRAFT",
  "COLLECTING_AVAILABILITY",
  "AVAILABILITY_CLOSED",
  "REVIEWING_RESULTS",
  "AWAITING_DEPARTMENT_APPROVAL",
  "DEPARTMENT_APPROVED",
  "COLLECTING_CONSENT",
  "CONSENT_COMPLETE",
  "READY_TO_FINALIZE",
])

const BOOKED_OH_STATUSES = ["approved", "scheduled", "completed"]
const BOOKED_DURATION_MS = 30 * 60 * 1000

function matchingAdjustmentId(
  adjustments: InstructorCalendarAdjustment[],
  meetingType: string | undefined,
): number | null {
  if (!adjustments.length) return null
  const exact = adjustments.find((a) => a.meetingType === meetingType || a.meetingType === "both")
  return exact?.id ?? adjustments[0]?.id ?? null
}

export async function buildInstructorCalendar(params: {
  courseId: number
  sessionId: number | null
  rangeStart: Date
  rangeEnd: Date
}): Promise<InstructorCalendarPayload> {
  const { courseId, sessionId, rangeStart, rangeEnd } = params

  await ensureScheduleAdjustmentSchema()
  await ensureOfficeHoursCourseScopeColumns()

  const [classMeetings, effectiveMeetings, requests] = await Promise.all([
    buildStudentClassMeetingEventsForRange({
      courseId,
      sessionId,
      rangeStart,
      rangeEnd,
    }),
    getEffectiveCourseMeetingSchedules(courseId, sessionId),
    listCourseRequests(courseId, { sectionId: sessionId }),
  ])

  const openAdjustments: InstructorCalendarAdjustment[] = requests
    .filter((row) => OPEN_ADJUSTMENT_STATUSES.has(row.status))
    .map((row) => ({
      id: Number(row.id),
      status: String(row.status),
      meetingType: String(row.meeting_type),
      reason: String(row.reason ?? ""),
    }))

  const sourcedMeetings =
    classMeetings.length > 0
      ? classMeetings
      : effectiveMeetings.flatMap((meeting) => {
          if (!meeting.schedule) return []
          return expandClassMeetingsForRange(
            meeting.schedule,
            {
              courseTitle: meeting.label,
              term: "",
              location: meeting.location,
            },
            rangeStart,
            rangeEnd,
          ).map((instance) => ({
            ...instance,
            meetingType: meeting.meetingType,
            pendingScheduleChange: false,
            syncToken: "",
          }))
        })

  const classEvents: InstructorCalendarEvent[] = sourcedMeetings.map((meeting) => {
    const adjustmentId = matchingAdjustmentId(openAdjustments, meeting.meetingType)
    const pending = meeting.pendingScheduleChange || Boolean(adjustmentId)
    return {
      id: `class:${meeting.meetingType}:${meeting.start_time}`,
      title: meeting.title,
      description: meeting.description,
      eventType: "class_meeting" as const,
      startTime: meeting.start_time,
      endTime: meeting.end_time,
      location: meeting.location || "",
      color: meeting.color,
      pendingScheduleChange: pending,
      meetingType: meeting.meetingType,
      scheduleAdjustmentId: adjustmentId,
      href: adjustmentId
        ? `/faculty/dashboard/administration/schedule-adjustment?id=${adjustmentId}`
        : undefined,
    }
  })

  const regularEvents: InstructorCalendarEvent[] = (
    await buildRegularOfficeHourOccurrences({
      courseId,
      sessionId,
      rangeStart,
      rangeEnd,
    })
  ).map((occurrence) => ({
    id: occurrence.id,
    title: "Office hours",
    description: "Weekly office hours for this course.",
    eventType: "regular_office_hours" as const,
    startTime: occurrence.startTime,
    endTime: occurrence.endTime,
    location: occurrence.location,
    color: "#059669",
    pendingScheduleChange: false,
    lastModified: occurrence.lastModified,
    href: "/faculty/dashboard/learning-center/office-hours",
  }))

  const hasRequestCourseId = await hasOfficeHourRequestsCourseIdColumn()
  const requestScope = buildOfficeHourRequestCourseScopeSqlFragment("ohr", courseId, hasRequestCourseId)
  const studentScope = buildOfficeHourStudentInCourseSqlFragment("s", courseId)
  const rangeStartIso = rangeStart.toISOString()
  const rangeEndIso = rangeEnd.toISOString()
  const bookedRows = (await sql`
    SELECT
      ohr.id,
      ohr.topic,
      ohr.status,
      ohr.scheduled_date,
      ohr.meeting_venue,
      ohr.meeting_link,
      s.full_name
    FROM office_hour_requests ohr
    JOIN students s ON s.id = ohr.student_id
    WHERE (${requestScope})
      AND (${studentScope})
      AND ohr.status = ANY(${BOOKED_OH_STATUSES})
      AND ohr.scheduled_date IS NOT NULL
      AND ohr.scheduled_date >= ${rangeStartIso}
      AND ohr.scheduled_date <= ${rangeEndIso}
    ORDER BY ohr.scheduled_date ASC
  `) as Array<{
    id: number
    topic: string | null
    status: string
    scheduled_date: string | Date
    meeting_venue: string | null
    meeting_link: string | null
    full_name: string | null
  }>

  const bookedEvents: InstructorCalendarEvent[] = bookedRows.map((row) => {
    const start = new Date(row.scheduled_date)
    const studentName = String(row.full_name ?? "Student").trim() || "Student"
    const topic = String(row.topic ?? "Office hours").trim() || "Office hours"
    const location = String(row.meeting_venue || row.meeting_link || "").trim()
    const startIso = Number.isNaN(start.getTime()) ? String(row.scheduled_date) : start.toISOString()
    const endIso = Number.isNaN(start.getTime())
      ? String(row.scheduled_date)
      : new Date(start.getTime() + BOOKED_DURATION_MS).toISOString()
    return {
      id: `oh-booked:${row.id}`,
      title: `Office hours · ${studentName}`,
      description: topic,
      eventType: "booked_office_hours",
      startTime: startIso,
      endTime: endIso,
      location,
      color: "#7c3aed",
      pendingScheduleChange: false,
      studentName,
      topic,
      officeHoursRequestId: Number(row.id),
      href: "/faculty/dashboard/learning-center/office-hours",
    }
  })

  const lecture = effectiveMeetings.find((m) => m.meetingType === "lecture")
  const primary = lecture ?? effectiveMeetings[0]

  const events = [...classEvents, ...regularEvents, ...bookedEvents].sort(
    (a, b) => a.startTime.localeCompare(b.startTime),
  )

  return {
    events,
    scheduleText: primary?.scheduleText?.trim() || null,
    location: primary?.location?.trim() || null,
    openAdjustments,
    calendarScope: "selected",
    scheduleSummaries: [],
  }
}

export function applyInstructorCalendarOfferingLabel(
  payload: InstructorCalendarPayload,
  label: InstructorCalendarOfferingLabel,
): InstructorCalendarPayload {
  const prefix = `c${label.courseId}:s${label.sessionId ?? 0}:`
  const scheduleSummaries: InstructorCalendarScheduleSummary[] = payload.scheduleText
    ? [
        {
          courseId: label.courseId,
          sessionId: label.sessionId,
          courseCode: label.courseCode,
          courseTitle: label.courseTitle,
          sessionCode: label.sessionCode,
          scheduleText: payload.scheduleText,
          location: payload.location,
        },
      ]
    : []

  return {
    ...payload,
    events: payload.events.map((event) => ({
      ...event,
      id: `${prefix}${event.id}`,
      courseId: label.courseId,
      sessionId: label.sessionId,
      courseCode: label.courseCode,
      courseTitle: label.courseTitle,
      sessionCode: label.sessionCode,
    })),
    openAdjustments: payload.openAdjustments.map((row) => ({
      ...row,
      courseId: label.courseId,
      courseCode: label.courseCode,
      sessionCode: label.sessionCode,
    })),
    scheduleSummaries,
  }
}

function offeringCalendarKey(offering: FacultyCourseOffering): string {
  return `${offering.course_id}:${offering.session_id ?? 0}`
}

export async function buildInstructorCalendarsForOfferings(params: {
  offerings: FacultyCourseOffering[]
  rangeStart: Date
  rangeEnd: Date
}): Promise<InstructorCalendarPayload> {
  const unique = new Map<string, FacultyCourseOffering>()
  for (const offering of params.offerings) {
    unique.set(offeringCalendarKey(offering), offering)
  }
  const list = [...unique.values()]
    .sort((a, b) => a.course_code.localeCompare(b.course_code))
    .slice(0, MAX_ALL_COURSE_OFFERINGS)

  const payloads: InstructorCalendarPayload[] = []
  for (let index = 0; index < list.length; index += ALL_COURSE_BATCH) {
    const batch = list.slice(index, index + ALL_COURSE_BATCH)
    const results = await Promise.all(
      batch.map(async (offering) => {
        try {
          const raw = await buildInstructorCalendar({
            courseId: offering.course_id,
            sessionId: offering.session_id ?? null,
            rangeStart: params.rangeStart,
            rangeEnd: params.rangeEnd,
          })
          return applyInstructorCalendarOfferingLabel(raw, {
            courseId: offering.course_id,
            sessionId: offering.session_id ?? null,
            courseCode: offering.course_code,
            courseTitle: offering.course_title,
            sessionCode: offering.session_code ?? null,
          })
        } catch {
          return null
        }
      }),
    )
    for (const result of results) {
      if (result) payloads.push(result)
    }
  }

  const events = payloads
    .flatMap((payload) => payload.events)
    .sort((a, b) => a.startTime.localeCompare(b.startTime))

  const seenAdjustments = new Set<string>()
  const openAdjustments: InstructorCalendarAdjustment[] = []
  for (const payload of payloads) {
    for (const row of payload.openAdjustments) {
      const key = `${row.courseId ?? 0}:${row.id}`
      if (seenAdjustments.has(key)) continue
      seenAdjustments.add(key)
      openAdjustments.push(row)
    }
  }

  const scheduleSummaries = payloads.flatMap((payload) => payload.scheduleSummaries ?? [])
  const only = payloads.length === 1 ? payloads[0] : null

  return {
    events,
    scheduleText: only?.scheduleText ?? (list.length > 1 ? "All courses this term" : null),
    location: only?.location ?? null,
    openAdjustments,
    calendarScope: "all",
    scheduleSummaries,
  }
}
