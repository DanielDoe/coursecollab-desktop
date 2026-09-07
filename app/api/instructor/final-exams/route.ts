import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { createBulkNotifications, sendNewAssessmentEmailsIfConfigured } from "@/lib/create-notification"
import { normalizeSessionAccessRecordToCanonical } from "@/lib/resolve-session-by-code"

export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function GET(request: NextRequest) {
  try {
    const instructorId = request.nextUrl.searchParams.get("instructorId")
    
    if (!instructorId) {
      return NextResponse.json({ error: "Instructor ID required" }, { status: 400 })
    }

    const finalExams = await sql`
      SELECT 
        q.*,
        COUNT(qa.id) as total_attempts,
        AVG(qa.score) as average_score,
        COUNT(CASE WHEN qa.completed_at IS NOT NULL THEN 1 END) as completion_count
      FROM quizzes q
      LEFT JOIN quiz_attempts qa ON q.id = qa.quiz_id
      WHERE q.instructor_id = ${instructorId} AND q.assessment_type = 'final'
      GROUP BY q.id
      ORDER BY q.created_at DESC
    `

    return NextResponse.json({ finalExams })
  } catch (error) {
    console.error("Error fetching final exams:", error)
    return NextResponse.json({ error: "Failed to fetch final exams" }, { status: 500 })
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
      exam_date
    } = body

    const normalizedSessionAccess = await normalizeSessionAccessRecordToCanonical(
      session_access as Record<string, boolean> | undefined,
    )

    const finalExam = await sql`
      INSERT INTO quizzes (
        title, description, assessment_type, instructor_id,
        time_per_question, retake_limit, difficulty, topic,
        session_access, question_count, is_active, is_saved,
        available_from, available_until
      ) VALUES (
        ${title}, ${description}, 'final', ${instructorId},
        ${time_per_question}, ${retake_limit}, ${difficulty}, ${topic},
        ${JSON.stringify(normalizedSessionAccess)}, ${questions.length}, true, true,
        ${exam_date || 'NOW()'}, ${exam_date ? `'${exam_date}'::timestamp + INTERVAL '4 hours'` : 'NOW() + INTERVAL \'4 hours\''}
      ) RETURNING *
    `

    const finalExamId = finalExam[0].id

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
          SELECT ${finalExamId}, s.id, (${sessionAccessJson}::jsonb->>s.code)::boolean, CURRENT_TIMESTAMP
          FROM sessions s
          WHERE s.code = ANY(${sessionCodes})
          ON CONFLICT (quiz_id, session_id) DO UPDATE SET
            is_active = EXCLUDED.is_active,
            updated_at = CURRENT_TIMESTAMP
        `
      }
    }

    // Notify students when a new final exam is posted (in-app + email)
    const sendNotifications = body.sendNotifications !== false
    if (sendNotifications) {
      const students = activeSessionIds.length > 0
        ? await sql`SELECT id FROM students WHERE session_id = ANY(${activeSessionIds})`
        : await sql`SELECT id FROM students`
      if (students.length > 0) {
        createBulkNotifications(
          students.map((s) => s.id),
          {
            type: "exam",
            title: "New final exam available! 📝",
            message: `A new final exam "${title}" has been published. Check it out!`,
            link: "/student/dashboard-v2/final-exams",
          },
        ).catch((err) => console.error("[Final exam] Failed to send notifications:", err))
        sendNewAssessmentEmailsIfConfigured(
          students.map((s) => s.id),
          "final",
          title,
          exam_date ? new Date(exam_date).toLocaleDateString("en-US", { dateStyle: "medium" }) : null
        )
      }
    }

    return NextResponse.json({ finalExam: finalExam[0] })
  } catch (error) {
    console.error("Error creating final exam:", error)
    return NextResponse.json({ error: "Failed to create final exam" }, { status: 500 })
  }
}

