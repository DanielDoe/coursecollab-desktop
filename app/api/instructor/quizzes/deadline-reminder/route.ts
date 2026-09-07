import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

import { createBulkNotifications } from "@/lib/create-notification"


/**
 * Cron job endpoint to send deadline reminders for quizzes
 * Should be called daily to check for upcoming deadlines
 */
export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function GET(request: NextRequest) {
  try {
    // Find quizzes with deadlines in the next 24 hours
    const upcomingQuizzes = await sql`
      SELECT 
        q.id,
        q.title,
        q.available_until,
        ARRAY_AGG(DISTINCT s.id) as student_ids
      FROM quizzes q
      CROSS JOIN students s
      WHERE q.available_until IS NOT NULL
        AND q.available_until > NOW()
        AND q.available_until <= NOW() + INTERVAL '24 hours'
        AND NOT EXISTS (
          SELECT 1 FROM quiz_attempts qa
          WHERE qa.quiz_id = q.id AND qa.student_id = s.id
        )
      GROUP BY q.id, q.title, q.available_until
    `

    let totalNotifications = 0

    for (const quiz of upcomingQuizzes) {
      const hoursLeft = Math.round((new Date(quiz.available_until).getTime() - Date.now()) / (1000 * 60 * 60))

      await createBulkNotifications(quiz.student_ids, {
        type: "deadline",
        title: `Quiz Deadline Approaching! ⏰`,
        message: `"${quiz.title}" is due in ${hoursLeft} hours. Don't forget to complete it!`,
        link: "/student/quizzes",
      })

      totalNotifications += quiz.student_ids.length
    }

    return NextResponse.json({
      success: true,
      quizzes_checked: upcomingQuizzes.length,
      notifications_sent: totalNotifications,
    })
  } catch (error) {
    console.error("[v0] Failed to send deadline reminders:", error)
    return NextResponse.json({ error: "Failed to send deadline reminders" }, { status: 500 })
  }
}
