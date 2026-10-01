import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { createNotification } from "@/lib/create-notification"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import { officeHourRequestInOfferingScopeFromRequest } from "@/lib/office-hours-course-scope"

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

    const inScope = await officeHourRequestInOfferingScopeFromRequest(
      request,
      requestId,
      scope.course.id,
    )
    if (!inScope) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 })
    }

    const body = await request.json()
    const {
      status,
      scheduledDate,
      meetingLink,
      meetingVenue,
      instructorNotes,
      topic,
      areaOfConcern,
      description,
      priority,
    } = body

    const current = await sql`
      SELECT * FROM office_hour_requests WHERE id = ${requestId} LIMIT 1
    `
    if (!current || current.length === 0) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 })
    }
    const row = current[0] as any
    const allowedStatus = new Set(["pending", "approved", "scheduled", "rejected", "completed", "cancelled"])
    const allowedPriority = new Set(["low", "medium", "high", "urgent"])
    if (status != null && !allowedStatus.has(String(status))) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 })
    }
    if (priority != null && !allowedPriority.has(String(priority))) {
      return NextResponse.json({ error: "Invalid priority" }, { status: 400 })
    }

    const newTopic = topic !== undefined ? String(topic).trim() : row.topic
    if (!newTopic) {
      return NextResponse.json({ error: "Topic is required" }, { status: 400 })
    }
    const newStatus = status ?? row.status
    const newArea = areaOfConcern !== undefined ? areaOfConcern || null : row.area_of_concern
    const newDescription = description !== undefined ? description || null : row.description
    const newPriority = priority !== undefined ? priority || "medium" : row.priority
    const newScheduled =
      scheduledDate !== undefined ? (scheduledDate ? new Date(scheduledDate) : null) : row.scheduled_date
    const newLink = meetingLink !== undefined ? meetingLink || null : row.meeting_link
    const newVenue = meetingVenue !== undefined ? meetingVenue || null : row.meeting_venue
    const newNotes = instructorNotes !== undefined ? instructorNotes || null : row.instructor_notes

    const result = await sql`
      UPDATE office_hour_requests
      SET topic = ${newTopic},
          area_of_concern = ${newArea},
          description = ${newDescription},
          priority = ${newPriority},
          status = ${newStatus},
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

    const detailLines = [
      updated.topic ? `Topic: ${updated.topic}` : "",
      updated.description ? `Details: ${updated.description}` : "",
      updated.scheduled_date
        ? `Scheduled: ${new Date(updated.scheduled_date).toLocaleString()}`
        : "",
      updated.meeting_link ? `Zoom / meeting link: ${updated.meeting_link}` : "",
      updated.meeting_venue ? `Venue: ${updated.meeting_venue}` : "",
      updated.instructor_notes ? `Note: ${updated.instructor_notes}` : "",
    ].filter(Boolean)
    const detailsChanged = [
      topic,
      areaOfConcern,
      description,
      priority,
      scheduledDate,
      meetingLink,
      meetingVenue,
      instructorNotes,
    ].some((value) => value !== undefined)

    if (status && ["rejected", "cancelled", "declined"].includes(String(status).toLowerCase())) {
      await createNotification({
        studentId: updated.student_id,
        type: "office_hours",
        title: "Office Hours Update",
        message: `Your office hours request (${updated.topic}) was ${status}.`,
        link: "/student/dashboard-v2/office-hours",
      })
    } else if (
      detailsChanged ||
      ["approved", "scheduled", "completed"].includes(String(newStatus))
    ) {
      const message = detailLines.length
        ? `Your office hours request was updated. ${detailLines.join(". ")}`
        : `Your office hours request (${updated.topic}) was updated.`
      await createNotification({
        studentId: updated.student_id,
        type: "office_hours",
        title: "Office Hours Update",
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
