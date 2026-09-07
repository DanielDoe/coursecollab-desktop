import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { createBulkNotifications, sendNewAssessmentEmailsIfConfigured } from "@/lib/create-notification"
import { normalizeSessionAccessRecordToCanonical } from "@/lib/resolve-session-by-code"
import { defaultHomeworkAvailableUntilUtc } from "@/lib/homework-deadline-policy"

export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function GET(request: NextRequest) {
  try {
    const instructorId = request.nextUrl.searchParams.get("instructorId")
    
    if (!instructorId) {
      return NextResponse.json({ error: "Instructor ID required" }, { status: 400 })
    }

    const homeworks = await sql`
      SELECT 
        q.*,
        COUNT(qa.id) FILTER (WHERE qa.deleted_at IS NULL) as total_attempts,
        AVG(qa.score) FILTER (WHERE qa.deleted_at IS NULL) as average_score,
        COUNT(CASE WHEN qa.completed_at IS NOT NULL AND qa.deleted_at IS NULL THEN 1 END) as completion_count
      FROM quizzes q
      LEFT JOIN quiz_attempts qa ON q.id = qa.quiz_id AND qa.deleted_at IS NULL
      WHERE q.instructor_id = ${instructorId} AND q.assessment_type = 'homework' AND q.deleted_at IS NULL
      GROUP BY q.id
      ORDER BY q.created_at DESC
    `

    return NextResponse.json({ homeworks })
  } catch (error) {
    console.error("Error fetching homeworks:", error)
    return NextResponse.json({ error: "Failed to fetch homeworks" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const instructorId = request.nextUrl.searchParams.get("instructorId")
    const body = await request.json()
    
    if (!instructorId) {
      return NextResponse.json({ error: "Instructor ID required" }, { status: 400 })
    }

    const {
      title,
      description,
      time_per_question,
      retake_limit,
      difficulty,
      topic,
      session_access,
      questions,
      deadline,
      available_from,
    } = body

    const normalizedSessionAccess = await normalizeSessionAccessRecordToCanonical(
      session_access as Record<string, boolean> | undefined,
    )

    const availableFromDate = available_from ? new Date(available_from) : new Date()
    const availableUntilDate = deadline
      ? new Date(deadline)
      : defaultHomeworkAvailableUntilUtc(availableFromDate)

    const homework = await sql`
      INSERT INTO quizzes (
        title, description, assessment_type, instructor_id,
        time_per_question, retake_limit, difficulty, topic,
        session_access, question_count, is_active, is_saved,
        available_from, available_until
      ) VALUES (
        ${title}, ${description}, 'homework', ${instructorId},
        ${time_per_question}, ${retake_limit}, ${difficulty}, ${topic},
        ${JSON.stringify(normalizedSessionAccess)}, ${questions.length}, true, true,
        ${availableFromDate}, ${availableUntilDate}
      ) RETURNING *
    `

    const homeworkId = homework[0].id

    // Batch create session access records (1 query + 1 insert instead of 2N queries)
    const sessionCodes = Object.keys(normalizedSessionAccess)
    let activeSessionIds: number[] = []
    if (sessionCodes.length > 0) {
      const sessionAccessJson = JSON.stringify(normalizedSessionAccess)
      const sessions = await sql`
        SELECT s.id, (${sessionAccessJson}::jsonb->>s.code)::boolean as is_active
        FROM sessions s
        WHERE s.code = ANY(${sessionCodes})
      `
      if (sessions.length > 0) {
        activeSessionIds = (sessions as { id: number; is_active: boolean }[])
          .filter((s) => s.is_active)
          .map((s) => s.id)
        await sql`
          INSERT INTO quiz_session_access (quiz_id, session_id, is_active, updated_at)
          SELECT ${homeworkId}, s.id, (${sessionAccessJson}::jsonb->>s.code)::boolean, CURRENT_TIMESTAMP
          FROM sessions s
          WHERE s.code = ANY(${sessionCodes})
          ON CONFLICT (quiz_id, session_id) DO UPDATE SET
            is_active = EXCLUDED.is_active,
            updated_at = CURRENT_TIMESTAMP
        `
      }
    }

    // Notify students with access to this homework (in-app + email)
    const sendNotifications = body.sendNotifications !== false
    if (sendNotifications) {
      const students = activeSessionIds.length > 0
        ? await sql`SELECT id FROM students WHERE session_id = ANY(${activeSessionIds})`
        : await sql`SELECT id FROM students`
      if (students.length > 0) {
        createBulkNotifications(
          students.map((s) => s.id),
          {
            type: "homework",
            title: "New homework available! 📝",
            message: `A new homework "${title}" has been assigned. Check it out!`,
            link: "/student/dashboard-v2/homework",
          },
        ).catch((err) => console.error("[Homework] Failed to send notifications:", err))
        sendNewAssessmentEmailsIfConfigured(
          students.map((s) => s.id),
          "homework",
          title,
          availableUntilDate.toLocaleDateString()
        )
        const { sendNewAssessmentEmails } = await import("@/lib/email/send-assessment-emails")
        const dueStr = availableUntilDate.toLocaleDateString("en-US", { dateStyle: "medium" })
        sendNewAssessmentEmails(students.map((s) => s.id), "homework", title, dueStr).then((r) => {
          if (r.sent > 0) console.log("[Homework] Emails sent:", r.sent, "skipped:", r.skipped)
        }).catch((e) => console.warn("[Homework] Email send error:", e))
      }
    }

    return NextResponse.json({ homework: homework[0] })
  } catch (error) {
    console.error("Error creating homework:", error)
    return NextResponse.json({ error: "Failed to create homework" }, { status: 500 })
  }
}

