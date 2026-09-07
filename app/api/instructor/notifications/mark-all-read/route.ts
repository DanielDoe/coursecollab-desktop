import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import {
  ensureInstructorNotificationOwnershipColumns,
  instructorNotificationOwnershipSqlFragment,
} from "@/lib/ensure-instructor-notification-ownership"
import { requireInstructorSession } from "@/lib/instructor-session-auth"

export async function POST(request: NextRequest) {
  try {
    // This endpoint had no authentication and no owner filter, so one instructor
    // clicking "mark all read" cleared the unread state for every instructor.
    const auth = await requireInstructorSession(request)
    if (!auth.ok) return auth.response

    const rawCourseId = Number(request.headers.get("x-course-id"))
    const courseId = Number.isFinite(rawCourseId) && rawCourseId > 0 ? Math.trunc(rawCourseId) : null

    await ensureInstructorNotificationOwnershipColumns()
    const ownedBy = instructorNotificationOwnershipSqlFragment("n", auth.instructorId, courseId)

    const updated = (await sql`
      UPDATE instructor_notifications n
      SET is_read = true, read_at = NOW()
      WHERE n.is_read = false AND ${ownedBy}
      RETURNING n.id
    `) as { id: number }[]

    return NextResponse.json({
      success: true,
      updated: updated.length,
      message: "All notifications marked as read",
    })
  } catch (error) {
    console.error("[Instructor Notifications] Failed to mark all as read:", error)
    return NextResponse.json({ error: "Failed to mark notifications as read" }, { status: 500 })
  }
}
