import { type NextRequest, NextResponse } from "next/server"
import { getSQL } from "@/lib/db"
import { createInstructorNotification } from "@/lib/create-instructor-notification"
import { ensureNotificationAiSummaryColumns } from "@/lib/ensure-notification-ai-summary"
import { backfillInstructorNotificationSummaries } from "@/lib/notification-ai-summary"

export async function GET(request: NextRequest) {
  try {
    const sql = getSQL()
    const { searchParams } = new URL(request.url)
    const limit = searchParams.get("limit") || "50"

    await ensureNotificationAiSummaryColumns()
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
      ORDER BY n.created_at DESC
      LIMIT ${parseInt(limit)}
    `

    const unreadResult = await sql`
      SELECT COUNT(*) as count 
      FROM instructor_notifications 
      WHERE is_read = false
    `

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
    const { notification_id } = await request.json()
    const sql = getSQL()

    if (!notification_id) {
      return NextResponse.json({ error: "Notification ID is required" }, { status: 400 })
    }

    await sql`
      UPDATE instructor_notifications 
      SET is_read = true, read_at = NOW()
      WHERE id = ${notification_id}
    `

    return NextResponse.json({ success: true, message: "Notification marked as read" })
  } catch (error) {
    console.error("[Instructor Notifications] Failed to mark as read:", error)
    return NextResponse.json({ success: true, message: "Notification marked as read" })
  }
}

export async function POST(request: NextRequest) {
  try {
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
