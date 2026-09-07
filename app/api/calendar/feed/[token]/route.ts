import { NextRequest, NextResponse } from "next/server"
import { listFacultyCourseOfferings } from "@/lib/faculty-course-offerings"
import { buildInstructorCalendarsForOfferings } from "@/lib/calendar/instructor-calendar"
import { buildStudentClassMeetingEventsForRange } from "@/lib/calendar/student-class-meetings"
import { buildRegularOfficeHourOccurrences } from "@/lib/calendar/regular-office-hours"
import { instructorEventCourseLabel } from "@/lib/calendar/instructor-calendar-events"
import { getCalendarFeedByToken } from "@/lib/calendar/feed-token"
import { buildClassCalendarIcs, calendarFeedHttpHeaders, type CalendarFeedEvent } from "@/lib/calendar/feed-ics"
import { sql } from "@/lib/db"

export const dynamic = "force-dynamic"

function feedRange() {
  const rangeStart = new Date()
  rangeStart.setHours(0, 0, 0, 0)
  const rangeEnd = new Date(rangeStart)
  rangeEnd.setMonth(rangeEnd.getMonth() + 6)
  return { rangeStart, rangeEnd }
}

async function facultyEvents(instructorId: number): Promise<CalendarFeedEvent[]> {
  const { rangeStart, rangeEnd } = feedRange()
  const offerings = await listFacultyCourseOfferings(instructorId)
  const active = offerings.filter((offering) => offering.is_active_term)
  const payload = await buildInstructorCalendarsForOfferings({
    offerings: active.length > 0 ? active : offerings,
    rangeStart,
    rangeEnd,
  })
  return payload.events
    .filter((event) => event.eventType === "class_meeting" || event.eventType === "regular_office_hours" || event.eventType === "booked_office_hours")
    .map((event) => {
      const course = instructorEventCourseLabel(event)
      return {
        uid: `${event.id}@course-collab.com`,
        title: course ? `${course} · ${event.title.replace(/^.*? — /, "")}` : event.title,
        startTime: event.startTime,
        endTime: event.endTime,
        location: event.location,
        description: event.description,
        lastModified: event.lastModified,
      }
    })
}

async function studentEvents(studentId: number): Promise<CalendarFeedEvent[]> {
  const rows = (await sql`
    SELECT course_id, session_id FROM students WHERE id = ${studentId} LIMIT 1
  `) as Array<{ course_id: number | null; session_id: number | null }>
  const courseId = Number(rows[0]?.course_id)
  if (!Number.isFinite(courseId) || courseId < 1) return []
  const sessionId = Number(rows[0]?.session_id)
  const { rangeStart, rangeEnd } = feedRange()
  const meetings = await buildStudentClassMeetingEventsForRange({
    courseId,
    sessionId: Number.isFinite(sessionId) && sessionId > 0 ? sessionId : null,
    rangeStart,
    rangeEnd,
  })
  const officeHours = await buildRegularOfficeHourOccurrences({
    courseId,
    sessionId: Number.isFinite(sessionId) && sessionId > 0 ? sessionId : null,
    rangeStart,
    rangeEnd,
  })
  return [
    ...meetings.map((event) => ({
      uid: `student-class-${event.id}@course-collab.com`,
      title: event.title,
      startTime: event.start_time,
      endTime: event.end_time,
      location: event.location,
      description: event.description,
    })),
    ...officeHours.map((event) => ({
      uid: `${event.id}@course-collab.com`,
      title: "Office hours",
      startTime: event.startTime,
      endTime: event.endTime,
      location: event.location,
      description: "Weekly office hours",
      lastModified: event.lastModified,
    })),
  ]
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await context.params
    const feed = await getCalendarFeedByToken(token)
    if (!feed) {
      return NextResponse.json({ error: "Calendar feed not found" }, { status: 404 })
    }

    const events =
      feed.portal === "faculty" ? await facultyEvents(feed.userId) : await studentEvents(feed.userId)

    const ics = buildClassCalendarIcs({
      calendarName: feed.portal === "faculty" ? "CourseCollab classes" : "CourseCollab class",
      events,
      beforeMinutes: feed.beforeMinutes,
      atStart: feed.atStart,
    })

    return new NextResponse(ics, { status: 200, headers: calendarFeedHttpHeaders() })
  } catch (error) {
    console.error("[Calendar feed GET]", error)
    return NextResponse.json({ error: "Failed to load calendar feed" }, { status: 500 })
  }
}
