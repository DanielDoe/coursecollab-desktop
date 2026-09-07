import { type NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { sql } from "@/lib/db"
import { createBulkNotifications, sendNewAssessmentEmailsIfConfigured } from "@/lib/create-notification"
import { getDefaultTimeLimit } from "@/lib/config/quizSettings"

const DEFAULT_TIME_LIMITS: Record<string, number> = {
  true_false: 30,
  mcq: 50,
  select_all: 60,
  fill_blank: 45,
  code_output: 75,
  code_debug: 90,
  fill_code: 60,
  trace_logic: 80,
  scenario_match: 70,
  multi_output: 80,
  code_reorder: 100,
  code_problem: 150,
  trace_output: 90,
  debug_code: 120,
  code_write: 180,
  code_explain: 120,
}

export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function POST(request: NextRequest) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    console.log("[v0] Starting mid-semester creation from bank")
    const body = await request.json()
    console.log("[v0] Request body:", JSON.stringify(body))

    const { title, description, time_limit, question_ids, custom_time_limits, available_from, available_until } = body

    if (!title) {
      console.log("[v0] Validation failed: Title is required")
      return NextResponse.json({ error: "Title is required" }, { status: 400 })
    }

    const adminId = 1 // TODO: Get from session

    const convertToUTC = (dateTimeLocal: string | null) => {
      if (!dateTimeLocal) return null
      const localDate = new Date(dateTimeLocal)
      return localDate.toISOString()
    }

    const availableFromUTC = convertToUTC(available_from)
    const availableUntilUTC = convertToUTC(available_until)

    console.log("[v0] Creating mid-semester with title:", title)
    const [midSemester] = await sql`
      INSERT INTO mid_semesters (
        title, 
        description, 
        created_by, 
        is_public, 
        time_per_question,
        available_from,
        available_until,
        created_at, 
        updated_at
      )
      VALUES (
        ${title}, 
        ${description || null}, 
        ${adminId}, 
        true, 
        ${time_limit || 30},
        ${availableFromUTC},
        ${availableUntilUTC},
        NOW(), 
        NOW()
      )
      RETURNING id
    `
    console.log("[v0] Mid-semester created with ID:", midSemester.id)

    if (!question_ids || question_ids.length === 0) {
      console.log("[v0] No questions selected")
      await sql`DELETE FROM mid_semesters WHERE id = ${midSemester.id}`
      return NextResponse.json({ error: "No questions selected" }, { status: 400 })
    }

    console.log("[v0] Fetching specific questions:", question_ids)
    const selectedQuestions = await sql`
      SELECT 
        id,
        question_text,
        question_type,
        difficulty,
        topic,
        options::text as options,
        correct_answer::text as correct_answer,
        hint
      FROM question_bank
      WHERE id = ANY(${question_ids})
    `

    console.log("[v0] Selected questions count:", selectedQuestions?.length || 0)

    if (!selectedQuestions || selectedQuestions.length === 0) {
      console.log("[v0] No questions found, cleaning up mid-semester")
      await sql`DELETE FROM mid_semesters WHERE id = ${midSemester.id}`
      return NextResponse.json({ error: "No questions found" }, { status: 400 })
    }

    const insertedQuestions = []
    for (const q of selectedQuestions) {
      let options = []
      try {
        options = JSON.parse(q.options || "[]")
      } catch (e) {
        options = []
      }

      const optionA = options[0] || null
      const optionB = options[1] || null
      const optionC = options[2] || null
      const optionD = options[3] || null
      const optionE = options[4] || null

      let correctAnswer = "A"
      if (q.correct_answer) {
        try {
          const parsed = JSON.parse(q.correct_answer)
          if (typeof parsed === "string" && ["A", "B", "C", "D", "E"].includes(parsed.trim())) {
            correctAnswer = parsed.trim()
          } else if (Array.isArray(parsed)) {
            correctAnswer = JSON.stringify(parsed)
          } else {
            const answerText = String(parsed).trim()
            if (answerText === optionA) correctAnswer = "A"
            else if (answerText === optionB) correctAnswer = "B"
            else if (answerText === optionC) correctAnswer = "C"
            else if (answerText === optionD) correctAnswer = "D"
            else if (answerText === optionE) correctAnswer = "E"
          }
        } catch (e) {
          const answerText = String(q.correct_answer).trim()
          if (["A", "B", "C", "D", "E"].includes(answerText)) {
            correctAnswer = answerText
          } else if (answerText === optionA) {
            correctAnswer = "A"
          } else if (answerText === optionB) {
            correctAnswer = "B"
          } else if (answerText === optionC) {
            correctAnswer = "C"
          } else if (answerText === optionD) {
            correctAnswer = "D"
          } else if (answerText === optionE) {
            correctAnswer = "E"
          }
        }
      }

      const timeLimit =
        custom_time_limits?.[q.id] ??
        DEFAULT_TIME_LIMITS[q.question_type] ??
        getDefaultTimeLimit(String(q.question_type || "mcq"))
      const questionOrder = insertedQuestions.length + 1

      const [inserted] = await sql`
        INSERT INTO mid_semester_questions (
          mid_semester_id, question_text, question_order, option_a, option_b, option_c, option_d, option_e,
          correct_answer, bank_question_id, time_limit, question_type, created_at
        ) VALUES (
          ${midSemester.id}, ${q.question_text}, ${questionOrder}, ${optionA}, ${optionB}, ${optionC}, ${optionD}, ${optionE},
          ${correctAnswer}, ${q.id}, ${timeLimit}, ${q.question_type}, NOW()
        ) RETURNING id, bank_question_id
      `

      insertedQuestions.push(inserted)
    }

    if (!insertedQuestions || insertedQuestions.length === 0) {
      console.log("[v0] ERROR: Failed to insert questions")
      await sql`DELETE FROM mid_semesters WHERE id = ${midSemester.id}`
      return NextResponse.json({ error: "Failed to insert questions into database" }, { status: 500 })
    }

    console.log(`[v0] Successfully inserted ${insertedQuestions.length} questions`)

    // Notify all students when a new mid-semester exam is posted (in-app + email)
    const sendNotifications = body.sendNotifications !== false
    if (sendNotifications) {
      const students = await sql`SELECT id FROM students`
      if (students.length > 0) {
        createBulkNotifications(
          students.map((s) => s.id),
          {
            type: "exam",
            title: "New mid-semester exam available! 📝",
            message: `A new mid-semester exam "${title}" has been published. Check it out!`,
            link: "/student/dashboard-v2/mid-semester-exams",
          },
        ).catch((err) => console.error("[Mid-semester] Failed to send notifications:", err))
        sendNewAssessmentEmailsIfConfigured(
          students.map((s) => s.id),
          "mid-semester",
          title,
          available_until ? new Date(available_until).toLocaleDateString("en-US", { dateStyle: "medium" }) : null
        )
        const { sendNewAssessmentEmails } = await import("@/lib/email/send-assessment-emails")
        const dueStr = available_until ? new Date(available_until).toLocaleDateString("en-US", { dateStyle: "medium" }) : null
        sendNewAssessmentEmails(students.map((s) => s.id), "mid-semester", title, dueStr).then((r) => {
          if (r.sent > 0) console.log("[Mid-semester] Emails sent:", r.sent)
        }).catch((e) => console.warn("[Mid-semester] Email error:", e))
      }
    }

    console.log("[v0] Mid-semester creation completed successfully")
    return NextResponse.json({
      success: true,
      mid_semester_id: midSemester.id,
      questions_added: insertedQuestions.length,
      total_time_minutes: time_limit,
    })
  } catch (error) {
    console.error("[v0] Failed to create mid-semester from bank:", error)
    return NextResponse.json(
      {
        error: "Failed to create mid-semester exam",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
