import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { createInstructorNotification } from "@/lib/create-instructor-notification"
import {
  ensureInstructorNotificationOwnershipColumns,
  instructorNotificationOwnershipSqlFragment,
} from "@/lib/ensure-instructor-notification-ownership"
import { requireInstructorSession } from "@/lib/instructor-session-auth"
import { ensureNotificationAiSummaryColumns } from "@/lib/ensure-notification-ai-summary"
import { backfillInstructorNotificationSummaries } from "@/lib/notification-ai-summary"

function callerCourseId(request: NextRequest): number | null {
  const raw = Number(request.headers.get("x-course-id"))
  return Number.isFinite(raw) && raw > 0 ? Math.trunc(raw) : null
}

export async function GET(request: NextRequest) {
  try {
    // Identity must come from the session. This table has no per-row owner unless
    // the ownership columns are present, and it used to be returned wholesale to
    // every caller.
    const auth = await requireInstructorSession(request)
    if (!auth.ok) return auth.response
    const instructorId = auth.instructorId
    const courseId = callerCourseId(request)

    const { searchParams } = new URL(request.url)
    const limit = searchParams.get("limit") || "50"

    await ensureNotificationAiSummaryColumns()
    await ensureInstructorNotificationOwnershipColumns()
    const ownedBy = instructorNotificationOwnershipSqlFragment("n", instructorId, courseId)
    void backfillInstructorNotificationSummaries(8).catch((error) => {
      console.warn("[Instructor Notifications] ai_summary backfill:", error)
    })

    const notifications = await sql`
      SELECT 
        n.*,
        CASE 
          WHEN n.source_type = 'student_submission' THEN s.full_name
          WHEN n.source_type = 'student_question' THEN s.full_name
          ELSE NULL
        END as source_name
      FROM instructor_notifications n
      LEFT JOIN students s ON n.source_id = s.id::text AND n.source_type IN ('student_submission', 'student_question')
      WHERE ${ownedBy}
      ORDER BY n.created_at DESC
      LIMIT ${parseInt(limit)}
    `

    const unreadResult = (await sql`
      SELECT COUNT(*) as count
      FROM instructor_notifications n
      WHERE n.is_read = false AND ${ownedBy}
    `) as { count: number }[]

    return NextResponse.json({
      notifications,
      unread_count: unreadResult[0]?.count || 0,
    })
  } catch (error) {
    console.error("[Instructor Notifications] Failed to fetch:", error)

    const mockNotifications = [
      {
        id: 1,
        type: "quiz_submission",
        title: "New Quiz Submissions",
        message: "15 students have submitted Quiz 3",
        link: "/instructor/results",
        is_read: false,
        created_at: new Date(Date.now() - 3600000).toISOString(),
        source_type: "quiz",
        source_id: "3",
        ai_summary: "Fifteen students submitted Quiz 3. Review results when ready.",
      },
      {
        id: 2,
        type: "student_question",
        title: "Student Question on Lecture 5",
        message: "John Doe asked a question about pointers",
        link: "/instructor/lectures",
        is_read: false,
        created_at: new Date(Date.now() - 7200000).toISOString(),
        source_type: "lecture",
        source_id: "5",
        source_name: "John Doe",
        ai_summary: "John Doe asked about pointers on Lecture 5.",
      },
      {
        id: 3,
        type: "low_completion",
        title: "Low Assignment Completion",
        message: "Only 60% of students completed Homework 2",
        link: "/instructor/homework",
        is_read: false,
        created_at: new Date(Date.now() - 10800000).toISOString(),
        source_type: "homework",
        source_id: "2",
        ai_summary: "Only 60% completed Homework 2. Consider a reminder.",
      },
      {
        id: 4,
        type: "deadline_reminder",
        title: "Upcoming Deadline",
        message: "Mid-semester exam is due in 2 days",
        link: "/instructor/mid-semester-exams",
        is_read: true,
        created_at: new Date(Date.now() - 14400000).toISOString(),
        source_type: "exam",
        source_id: "1",
        ai_summary: "Mid-semester exam is due in two days.",
      },
      {
        id: 5,
        type: "analytics",
        title: "Weekly Analytics Ready",
        message: "Your weekly performance report is available",
        link: "/instructor/analytics",
        is_read: true,
        created_at: new Date(Date.now() - 86400000).toISOString(),
        source_type: "system",
        source_id: null,
        ai_summary: "Your weekly performance report is ready to review.",
      },
    ]

    return NextResponse.json({
      notifications: mockNotifications,
      unread_count: 3,
    })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    // Previously any caller could mark any id read, including other instructors'.
    const auth = await requireInstructorSession(request)
    if (!auth.ok) return auth.response

    const { notification_id } = await request.json()

    if (!notification_id) {
      return NextResponse.json({ error: "Notification ID is required" }, { status: 400 })
    }

    await ensureInstructorNotificationOwnershipColumns()
    const ownedBy = instructorNotificationOwnershipSqlFragment(
      "n",
      auth.instructorId,
      callerCourseId(request),
    )

    const updated = (await sql`
      UPDATE instructor_notifications n
      SET is_read = true, read_at = NOW()
      WHERE n.id = ${notification_id} AND ${ownedBy}
      RETURNING n.id
    `) as { id: number }[]

    if (updated.length === 0) {
      return NextResponse.json({ error: "Notification not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true, message: "Notification marked as read" })
  } catch (error) {
    console.error("[Instructor Notifications] Failed to mark as read:", error)
    return NextResponse.json({ error: "Failed to mark notification as read" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireInstructorSession(request)
    if (!auth.ok) return auth.response

    const { type, title, message, link, source_type, source_id } = await request.json()

    if (!type || !title || !message) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    await ensureNotificationAiSummaryColumns()

    const notification = await createInstructorNotification({
      type,
      title,
      message,
      link,
      source_type,
      source_id,
      instructorId: auth.instructorId,
      courseId: callerCourseId(request),
    })

    return NextResponse.json({
      notification,
      message: "Notification created successfully",
    })
  } catch (error) {
    console.error("[Instructor Notifications] Failed to create:", error)
    return NextResponse.json({ error: "Failed to create notification" }, { status: 500 })
  }
}
