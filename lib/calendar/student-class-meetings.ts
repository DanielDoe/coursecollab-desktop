import { sql } from "@/lib/db"
import { ensureScheduleAdjustmentSchema } from "@/lib/ensure-schedule-adjustment-schema"
import { getSyllabusByCourseId } from "@/lib/syllabus/syllabus-service"
import { getSyllabusCourseInfo } from "@/lib/syllabus/syllabus-course-info"
import { getEffectiveCourseMeetingSchedules } from "@/lib/schedule-adjustment/schedule-source"
import {
  applyCancelledDatesToEvents,
  applyMakeupMeetingsToEvents,
  expandVersionedClassMeetingsForRange,
  pickVersionForDate,
  type DatedScheduleVersion,
} from "@/lib/schedule-adjustment/calendar-versions"
import {
  expandClassMeetingsForRange,
  parseCourseMeetingSchedule,
  type ClassMeetingCalendarEvent,
  type SyllabusCalendarContext,
} from "@/lib/syllabus/calendar-export"
import { parseTimeToMinutes } from "@/lib/schedule-adjustment/time-slots"

const ACTIVE_ADJUSTMENT_STATUSES = [
  "COLLECTING_AVAILABILITY",
  "AVAILABILITY_CLOSED",
  "REVIEWING_RESULTS",
  "AWAITING_DEPARTMENT_APPROVAL",
  "DEPARTMENT_APPROVED",
  "COLLECTING_CONSENT",
  "CONSENT_COMPLETE",
  "READY_TO_FINALIZE",
]

export type BuiltClassMeetingEvent = ClassMeetingCalendarEvent & {
  meetingType: "lecture" | "laboratory" | "instructor_led" | "structured"
  pendingScheduleChange: boolean
  syncToken: string
}

function meetingLabel(meetingType: string): string {
  if (meetingType === "structured") return "Structured CourseCollab Session"
  if (meetingType === "instructor_led") return "Instructor Led Session"
  return meetingType === "laboratory" ? "Laboratory" : "Lecture"
}

function meetingColor(meetingType: string, pending: boolean): string {
  if (pending) return "#f59e0b"
  if (meetingType === "structured") return "#0f766e"
  if (meetingType === "instructor_led") return "#6d28d9"
  return meetingType === "laboratory" ? "#0369a1" : "#0284c7"
}

function meetingDescription(meetingType: string, base: string): string {
  if (meetingType === "structured") {
    return [
      base,
      "",
      "Structured CourseCollab Session",
      "Attendance check in required",
      "Open CourseCollab during the scheduled session",
      "Complete assigned course activities",
    ].join("\n")
  }
  return base
}

function syncDescriptionPrefix(
  courseId: number,
  sessionId: number | null,
  meetingType: string,
  dateKey: string,
) {
  return `cc_sync:${courseId}:${sessionId ?? 0}:${meetingType}:${dateKey}`
}

export async function pendingMeetingTypesForSection(
  courseId: number,
  sessionId: number | null,
): Promise<Set<string>> {
  await ensureScheduleAdjustmentSchema()
  const rows = (await sql`
    SELECT meeting_type
    FROM schedule_adjustment_requests
    WHERE course_id = ${courseId}
      AND (section_id IS NOT DISTINCT FROM ${sessionId})
      AND archived_at IS NULL
      AND status = ANY(${ACTIVE_ADJUSTMENT_STATUSES})
  `) as { meeting_type: string }[]
  return new Set(rows.map((r) => String(r.meeting_type)))
}

export async function buildStudentClassMeetingEventsForRange(params: {
  courseId: number
  sessionId: number | null
  rangeStart: Date
  rangeEnd: Date
}): Promise<BuiltClassMeetingEvent[]> {
  const syllabus = await getSyllabusByCourseId(params.courseId, params.sessionId)
  if (!syllabus || syllabus.status !== "published") return []

  const courseInfo = await getSyllabusCourseInfo(params.courseId)
  const courseTitle =
    courseInfo?.courseTitle || courseInfo?.courseCode || syllabus.title || "Course"

  const baseContext: SyllabusCalendarContext = {
    courseTitle,
    term: syllabus.term || "Fall 2026",
    location: undefined,
  }

  let location = ""
  for (const section of syllabus.sections) {
    const fields = section.content?.fields
    if (!fields) continue
    for (const [label, value] of Object.entries(fields)) {
      if (label.toLowerCase().includes("meeting location") && value?.trim()) {
        location = value.trim()
      }
    }
  }
  baseContext.location = location || undefined

  const effectiveMeetings = await getEffectiveCourseMeetingSchedules(
    params.courseId,
    params.sessionId,
  )
  const pendingTypes = await pendingMeetingTypesForSection(params.courseId, params.sessionId)

  const versionRows = (await sql`
    SELECT meeting_type, day_of_week, start_time, end_time, location, schedule_text,
           effective_from::text AS effective_from, effective_until::text AS effective_until
    FROM course_schedule_versions
    WHERE course_id = ${params.courseId}
      AND (section_id IS NULL OR section_id = ${params.sessionId ?? null})
    ORDER BY version ASC
  `) as Array<{
    meeting_type: string
    schedule_text: string | null
    location: string | null
    effective_from: string
    effective_until: string | null
  }>

  const versionsByType = new Map<string, DatedScheduleVersion[]>()
  for (const row of versionRows) {
    const meetingType =
      row.meeting_type === "structured" || row.meeting_type === "instructor_led"
        ? row.meeting_type
        : row.meeting_type === "laboratory"
          ? "laboratory"
          : "lecture"
    const text = row.schedule_text
    const parsed = text ? parseCourseMeetingSchedule(text) : null
    if (!parsed) continue
    const list = versionsByType.get(meetingType) ?? []
    list.push({
      meetingType,
      schedule: parsed,
      location: row.location ?? undefined,
      scheduleText: text ?? "",
      effectiveFrom: String(row.effective_from).slice(0, 10),
      effectiveUntil: row.effective_until ? String(row.effective_until).slice(0, 10) : null,
    })
    versionsByType.set(meetingType, list)
  }

  const built: BuiltClassMeetingEvent[] = []
  const allVersions = [...versionsByType.values()].flat()
  const typesToExpand = new Set<string>([
    ...effectiveMeetings.map((meeting) => meeting.meetingType),
    ...versionsByType.keys(),
  ])

  for (const type of typesToExpand) {
    const meeting = effectiveMeetings.find((item) => item.meetingType === type)
    const typeVersions = versionsByType.get(type) ?? []
    if (!meeting?.schedule && typeVersions.length === 0) continue

    const label = meetingLabel(type)
    const context: SyllabusCalendarContext = {
      ...baseContext,
      courseTitle: `${courseTitle} — ${label}`,
      location: meeting?.location ?? baseContext.location,
    }

    const instances =
      typeVersions.length > 0
        ? expandVersionedClassMeetingsForRange({
            versions: typeVersions,
            fallbackSchedule: meeting?.schedule ?? null,
            fallbackLocation: meeting?.location ?? location,
            context,
            rangeStart: params.rangeStart,
            rangeEnd: params.rangeEnd,
            meetingType: type,
          })
        : meeting?.schedule
          ? expandClassMeetingsForRange(
              meeting.schedule,
              context,
              params.rangeStart,
              params.rangeEnd,
            )
          : []

    const pending = pendingTypes.has(type) || pendingTypes.has("both")

    for (const instance of instances) {
      const dateKey = String(instance.start_time).slice(0, 10)
      const day = new Date(`${dateKey}T12:00:00`)
      const dualActive =
        Boolean(pickVersionForDate(allVersions, day, "instructor_led")) ||
        Boolean(pickVersionForDate(allVersions, day, "structured"))
      if (dualActive && (type === "lecture" || type === "laboratory")) continue

      built.push({
        ...instance,
        meetingType: type as BuiltClassMeetingEvent["meetingType"],
        pendingScheduleChange: pending,
        title: pending ? `${instance.title} (schedule pending)` : instance.title,
        color: meetingColor(type, pending),
        description: pending
          ? `${meetingDescription(type, instance.description)}\n\nSchedule adjustment in progress — this time may change after the class votes.`
          : meetingDescription(type, instance.description),
        syncToken: syncDescriptionPrefix(params.courseId, params.sessionId, type, dateKey),
      })
    }
  }

  await ensureScheduleAdjustmentSchema()
  const makeupRows = await sql`
    SELECT missed_date::text AS missed_date, new_date::text AS new_date,
           start_time::text AS start_time, end_time::text AS end_time, location
    FROM course_makeup_meetings
    WHERE course_id = ${params.courseId}
  `
  let cancelledDates: string[] = []
  try {
    const cancelledRows = await sql`
      SELECT start_time::text AS start_time
      FROM attendance_sessions
      WHERE course_id = ${params.courseId}
        AND COALESCE(is_cancelled, false) = true
    `
    cancelledDates = (cancelledRows as Array<{ start_time: string }>).map((row) =>
      String(row.start_time).slice(0, 10),
    )
  } catch {
    cancelledDates = []
  }

  const withMakeups = applyMakeupMeetingsToEvents(
    built,
    (makeupRows as Array<{
      missed_date: string
      new_date: string
      start_time: string
      end_time: string
      location: string | null
    }>).map((row) => {
      const start = parseTimeToMinutes(String(row.start_time))
      const end = parseTimeToMinutes(String(row.end_time))
      return {
        missedDate: String(row.missed_date).slice(0, 10),
        newDate: String(row.new_date).slice(0, 10),
        startHour: Math.floor(start / 60),
        startMinute: start % 60,
        endHour: Math.floor(end / 60),
        endMinute: end % 60,
        location: row.location ?? undefined,
      }
    }),
    courseTitle,
  ) as BuiltClassMeetingEvent[]

  return applyCancelledDatesToEvents(withMakeups, cancelledDates) as BuiltClassMeetingEvent[]
}

export async function syncClassMeetingsToStudentCalendar(params: {
  studentDbId: number
  courseId: number
  sessionId: number | null
  rangeStart?: Date
  rangeEnd?: Date
}): Promise<{ inserted: number; deleted: number }> {
  const rangeStart = params.rangeStart ?? new Date()
  const rangeEnd =
    params.rangeEnd ??
    new Date(rangeStart.getFullYear(), rangeStart.getMonth() + 4, 0, 23, 59, 59, 999)

  const events = await buildStudentClassMeetingEventsForRange({
    courseId: params.courseId,
    sessionId: params.sessionId,
    rangeStart,
    rangeEnd,
  })

  const deletePattern = `cc_sync:${params.courseId}:${params.sessionId ?? 0}:%`
  const deletedRows = (await sql`
    DELETE FROM calendar_events
    WHERE student_id = ${params.studentDbId}
      AND related_type = 'class_meeting'
      AND description LIKE ${deletePattern}
    RETURNING id
  `) as { id: number }[]

  let inserted = 0
  for (const event of events) {
    await sql`
      INSERT INTO calendar_events (
        student_id,
        title,
        description,
        event_type,
        start_time,
        end_time,
        all_day,
        location,
        color,
        reminder_minutes,
        related_type,
        related_id
      ) VALUES (
        ${params.studentDbId},
        ${event.title},
        ${`${event.syncToken}|${event.description}`},
        'class_meeting',
        ${event.start_time},
        ${event.end_time},
        false,
        ${event.location || null},
        ${event.color},
        60,
        'class_meeting',
        ${params.courseId}
      )
    `
    inserted++
  }

  return { inserted, deleted: deletedRows.length }
}

export async function resyncClassMeetingsForCourseSection(
  courseId: number,
  sessionId: number | null,
): Promise<{ students: number; inserted: number }> {
  const students = (await sql`
    SELECT s.id AS student_db_id, s.session_id
    FROM students s
    LEFT JOIN sessions sess ON sess.id = s.session_id
    WHERE s.deleted_at IS NULL
      AND COALESCE(s.course_id, sess.course_id) = ${courseId}
      AND (${sessionId == null} OR s.session_id = ${sessionId})
  `) as { student_db_id: number; session_id: number | null }[]

  let inserted = 0
  for (const row of students) {
    const result = await syncClassMeetingsToStudentCalendar({
      studentDbId: row.student_db_id,
      courseId,
      sessionId: row.session_id ?? sessionId,
    })
    inserted += result.inserted
  }

  return { students: students.length, inserted }
}
