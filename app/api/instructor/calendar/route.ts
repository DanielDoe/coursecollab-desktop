import { NextRequest, NextResponse } from "next/server"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import { readInstructorSessionScopeFromRequest, resolveInstructorSessionCodeForScope } from "@/lib/instructor-session-scope"
import { parseUniversityIdFromRequest } from "@/lib/instructor-university-scope"
import { listFacultyCourseOfferings } from "@/lib/faculty-course-offerings"
import {
  applyInstructorCalendarOfferingLabel,
  buildInstructorCalendar,
  buildInstructorCalendarsForOfferings,
} from "@/lib/calendar/instructor-calendar"

export const dynamic = "force-dynamic"

function parseRangeDate(value: string | null, fallback: Date): Date {
  if (!value?.trim()) return fallback
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? fallback : parsed
}

export async function GET(request: NextRequest) {
  try {
    const scoped = await requireInstructorCourse(request)
    if (!scoped.ok) return scoped.response

    const { searchParams } = new URL(request.url)
    const rangeStart = parseRangeDate(searchParams.get("startDate"), new Date())
    const defaultEnd = new Date(rangeStart.getFullYear(), rangeStart.getMonth() + 3, 0)
    const rangeEnd = parseRangeDate(searchParams.get("endDate"), defaultEnd)
    const sessionScope = readInstructorSessionScopeFromRequest(request)
    const calendarScope = searchParams.get("scope") === "all" ? "all" : "selected"

    if (calendarScope === "all") {
      const universityId = parseUniversityIdFromRequest(request)
      let offerings = await listFacultyCourseOfferings(scoped.instructorId, universityId)
      const active = offerings.filter((offering) => offering.is_active_term)
      if (active.length > 0) offerings = active
      const payload = await buildInstructorCalendarsForOfferings({
        offerings,
        rangeStart,
        rangeEnd,
      })
    return NextResponse.json({ success: true, ...payload }, {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    })
    }

    const sessionCode = await resolveInstructorSessionCodeForScope(request)
    const payload = applyInstructorCalendarOfferingLabel(
      await buildInstructorCalendar({
        courseId: scoped.course.id,
        sessionId: sessionScope.sessionId,
        rangeStart,
        rangeEnd,
      }),
      {
        courseId: scoped.course.id,
        sessionId: sessionScope.sessionId,
        courseCode: scoped.course.course_code,
        courseTitle: scoped.course.course_title,
        sessionCode,
      },
    )

    return NextResponse.json(
      { success: true, ...payload, calendarScope: "selected" },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } },
    )
  } catch (error) {
    console.error("[Instructor Calendar GET]", error)
    return NextResponse.json({ success: false, error: "Failed to load calendar" }, { status: 500 })
  }
}
