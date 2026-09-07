import { type NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { sql } from "@/lib/db"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function POST(request: NextRequest) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const {
      title,
      description,
      time_per_question,
      available_from,
      available_until,
      questions,
      sendNotifications = true,
      retake_enabled = false,
      retake_limit = 0,
      retake_policy = "best",
      review_before_retake = false,
    } = await request.json()

    const adminId = 1 // TODO: Get from session

    const convertToUTC = (dateTimeLocal: string | null) => {
      if (!dateTimeLocal) return null
      // datetime-local format: "2025-01-08T14:30"
      // Treat as local time and convert to UTC
      const localDate = new Date(dateTimeLocal)
      return localDate.toISOString()
    }

    const availableFromUTC = convertToUTC(available_from)
    const availableUntilUTC = convertToUTC(available_until)

    console.log("[v0] Creating quiz with availability:", {
      available_from_input: available_from,
      available_from_utc: availableFromUTC,
      available_until_input: available_until,
      available_until_utc: availableUntilUTC,
    })

    const quizResult = await sql`
      INSERT INTO quizzes (
        title, 
        description, 
        time_per_question, 
        created_by, 
        is_public,
        available_from,
        available_until,
        retake_enabled,
        retake_limit,
        retake_policy,
        review_before_retake,
        created_at,
        updated_at
      )
      VALUES (
        ${title}, 
        ${description}, 
        ${time_per_question || 60}, 
        ${adminId}, 
        true,
        ${availableFromUTC},
        ${availableUntilUTC},
        ${retake_enabled},
        ${retake_limit === 0 ? null : retake_limit},
        ${retake_policy},
        ${review_before_retake},
        NOW(),
        NOW()
      )
      RETURNING id
    `

    const quizId = quizResult[0].id

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i]

      await sql`
        INSERT INTO quiz_questions (
          quiz_id, question_text, option_a, option_b, option_c, option_d, option_e,
          correct_answer, question_order, time_limit, question_type, max_points, points, created_at
        )
        VALUES (
          ${quizId}, ${q.question_text}, ${q.option_a || null}, ${q.option_b || null}, 
          ${q.option_c || null}, ${q.option_d || null}, ${q.option_e || null},
          ${q.correct_answer}, ${i + 1}, 
          ${q.time_limit || null}, ${q.question_type || "mcq"}, 
          ${q.max_points || q.points || null}, ${q.points || q.max_points || 1}, NOW()
        )
      `
    }

    console.log("[v0] Creating quiz session access for all sessions...")
    const allSessions = await sql`
      SELECT id FROM sessions
    `

    for (const session of allSessions) {
      await sql`
        INSERT INTO quiz_session_access (quiz_id, session_id, is_active, updated_at)
        VALUES (${quizId}, ${session.id}, true, CURRENT_TIMESTAMP)
        ON CONFLICT (quiz_id, session_id) DO NOTHING
      `
    }
    console.log(`[v0] Created session access for ${allSessions.length} sessions`)

    if (sendNotifications) {
      const students = await sql`
        SELECT id FROM students
      `

      const { createBulkNotifications } = await import("@/lib/create-notification")
      await createBulkNotifications(
        students.map((s) => s.id),
        {
          type: "quiz",
          title: "New Quiz Available! 📝",
          message: `A new quiz "${title}" has been published. Check it out!`,
          link: "/student/quizzes",
        },
      )
      console.log(`[v0] Notified ${students.length} students about new quiz`)
    } else {
      console.log("[v0] Skipped sending notifications (admin opted out)")
    }

    return NextResponse.json({ quizId })
  } catch (error) {
    console.error("[v0] Failed to create quiz:", error)
    return NextResponse.json({ error: "Failed to create quiz" }, { status: 500 })
  }
}
