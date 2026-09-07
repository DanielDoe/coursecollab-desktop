import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { createNotification } from "@/lib/create-notification"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import { officeHourRequestInCourseScope } from "@/lib/office-hours-course-scope"

export const dynamic = "force-dynamic"

/** PATCH - Approve, schedule, or update an office hour request (course-scoped) */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response

    const { id } = await params
    const requestId = Number.parseInt(id, 10)
    if (!Number.isFinite(requestId)) {
      return NextResponse.json({ error: "Invalid request id" }, { status: 400 })
    }

    const inScope = await officeHourRequestInCourseScope(requestId, scope.course.id)
    if (!inScope) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 })
    }

    const body = await request.json()
    const { status, scheduledDate, meetingLink, meetingVenue, instructorNotes } = body

    const current = await sql`
      SELECT * FROM office_hour_requests WHERE id = ${requestId} LIMIT 1
    `
    if (!current || current.length === 0) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 })
    }
    const row = current[0] as any
    const newStatus = status ?? row.status
    const newScheduled =
      scheduledDate !== undefined ? (scheduledDate ? new Date(scheduledDate) : null) : row.scheduled_date
    const newLink = meetingLink !== undefined ? meetingLink || null : row.meeting_link
    const newVenue = meetingVenue !== undefined ? meetingVenue || null : row.meeting_venue
    const newNotes = instructorNotes !== undefined ? instructorNotes || null : row.instructor_notes

    const result = await sql`
      UPDATE office_hour_requests
      SET status = ${newStatus},
          scheduled_date = ${newScheduled},
          meeting_link = ${newLink},
          meeting_venue = ${newVenue},
          instructor_notes = ${newNotes},
          instructor_id = ${scope.instructorId},
          updated_at = NOW()
      WHERE id = ${requestId}
      RETURNING *
    `
    const updated = result[0] as any
    if (!updated) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 })
    }

    if (status && ["approved", "scheduled"].includes(status)) {
      const studentId = updated.student_id
      const details: string[] = []
      if (updated.scheduled_date) details.push(`Scheduled: ${new Date(updated.scheduled_date).toLocaleString()}`)
      if (updated.meeting_link) details.push(`Meeting link: ${updated.meeting_link}`)
      if (updated.meeting_venue) details.push(`Venue: ${updated.meeting_venue}`)
      const message = details.length
        ? `Your office hours request (${updated.topic}) has been ${status}. ${details.join(". ")}`
        : `Your office hours request (${updated.topic}) has been ${status}.`
      await createNotification({
        studentId,
        type: "forum",
        title: "Office Hours Approved",
        message,
        link: "/student/dashboard-v2/office-hours",
      })
    }

    return NextResponse.json({ success: true, request: updated })
  } catch (error) {
    console.error("[Instructor Office Hours] PATCH:", error)
    return NextResponse.json({ error: "Failed to update request" }, { status: 500 })
  }
}
