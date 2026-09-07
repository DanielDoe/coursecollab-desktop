import { NextRequest, NextResponse } from "next/server"
import { resolveStudentCourseContextFromRequest } from "@/lib/student-course-scope"
import { requireStudentIdParamMatchesCaller } from "@/lib/student-api-auth"
import { buildStudentClassMeetingEventsForRange } from "@/lib/calendar/student-class-meetings"
import { buildRegularOfficeHourOccurrences } from "@/lib/calendar/regular-office-hours"
import { getSyllabusByCourseId } from "@/lib/syllabus/syllabus-service"
import { getEffectiveCourseMeetingSchedules } from "@/lib/schedule-adjustment/schedule-source"

export const dynamic = "force-dynamic"

function numericOccurrenceId(seed: string): number {
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0
  const value = Math.abs(hash)
  return value === 0 ? 1 : value
}

function toStudentOfficeHourEvents(
  occurrences: Awaited<ReturnType<typeof buildRegularOfficeHourOccurrences>>,
) {
  return occurrences.map((occurrence) => ({
    id: numericOccurrenceId(occurrence.id),
    title: "Office hours",
    description: "Weekly office hours",
    event_type: "office_hours",
    start_time: occurrence.startTime,
    end_time: occurrence.endTime,
    all_day: false,
    location: occurrence.location || null,
    color: "#059669",
    is_completed: false,
    isClassMeeting: false,
  }))
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const studentId = searchParams.get("studentId")
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")

    const auth = await requireStudentIdParamMatchesCaller(request, studentId)
    if (!auth.ok) return auth.response

    const resolved = await resolveStudentCourseContextFromRequest(request)
    if (!resolved.ok) return resolved.response

    const rangeStart = startDate ? new Date(startDate) : new Date()
    const rangeEnd = endDate
      ? new Date(endDate)
      : new Date(rangeStart.getFullYear(), rangeStart.getMonth() + 3, 0)

    const officeHoursEvents = toStudentOfficeHourEvents(
      await buildRegularOfficeHourOccurrences({
        courseId: resolved.ctx.courseId,
        sessionId: resolved.ctx.sessionId,
        rangeStart,
        rangeEnd,
      }),
    )

    const syllabus = await getSyllabusByCourseId(resolved.ctx.courseId, resolved.ctx.sessionId)
    if (!syllabus || syllabus.status !== "published") {
      return NextResponse.json({
        success: true,
        hasSchedule: false,
        scheduleText: null,
        location: null,
        context: null,
        events: [],
        officeHoursEvents,
        message: "Syllabus not published — class meetings unavailable.",
      })
    }

    const events = await buildStudentClassMeetingEventsForRange({
      courseId: resolved.ctx.courseId,
      sessionId: resolved.ctx.sessionId,
      rangeStart,
      rangeEnd,
    })

    const effectiveMeetings = await getEffectiveCourseMeetingSchedules(
      resolved.ctx.courseId,
      resolved.ctx.sessionId,
    )
    const lecture = effectiveMeetings.find((m) => m.meetingType === "lecture")
    const primary = lecture ?? effectiveMeetings[0]

    if (!events.length && !primary?.schedule) {
      return NextResponse.json({
        success: true,
        hasSchedule: false,
        scheduleText: primary?.scheduleText || null,
        location: primary?.location || null,
        context: null,
        events: [],
        officeHoursEvents,
        message: "No class meeting schedule found in syllabus.",
      })
    }

    return NextResponse.json({
      success: true,
      hasSchedule: events.length > 0,
      scheduleText: primary?.scheduleText ?? null,
      location: primary?.location ?? null,
      schedule: primary?.schedule ?? null,
      context: {
        courseTitle: syllabus.title,
        term: syllabus.term,
        location: primary?.location,
      },
      events: events.map((e) => ({ ...e, isClassMeeting: true })),
      officeHoursEvents,
    })
  } catch (error) {
    console.error("[Calendar Class Schedule GET Error]", error)
    return NextResponse.json(
      { success: false, error: "Failed to load class schedule" },
      { status: 500 },
    )
  }
}
