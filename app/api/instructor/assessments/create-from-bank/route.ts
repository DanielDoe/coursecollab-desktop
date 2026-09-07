import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { minimalBankLinkedQuizQuestionFields } from "@/lib/resolve-quiz-question-from-bank"
import { getDefaultTimeLimit } from "@/lib/config/quizSettings"
import { createBulkNotifications, sendNewAssessmentEmailsIfConfigured } from "@/lib/create-notification"

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
  code_problem: 420,   // 7 minutes
  trace_output: 90,
  debug_code: 120,
  code_write: 420,    // 7 minutes (avg 7–8 min; reduces cheating)
  code_explain: 120,
}

function escapeSqlString(str: string | null): string {
  if (str === null) return "NULL"
  return `'${str.replace(/'/g, "''")}'`
}

export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function POST(request: NextRequest) {
  try {
    console.log("[v0] Starting instructor assessment creation from bank")
    const body = await request.json()
    console.log("[v0] Request body:", JSON.stringify(body))

    const {
      title,
      description,
      time_limit,
      question_ids,
      custom_time_limits,
      available_from,
      available_until,
      assessment_type,
      instructor_id,
    } = body

    // Validation
    if (!title) {
      console.log("[v0] Validation failed: Title is required")
      return NextResponse.json({ error: "Title is required" }, { status: 400 })
    }

    if (!question_ids || question_ids.length === 0) {
      console.log("[v0] Validation failed: At least one question is required")
      return NextResponse.json({ error: "At least one question is required" }, { status: 400 })
    }

    if (!instructor_id) {
      console.log("[v0] Validation failed: Instructor ID is required")
      return NextResponse.json({ error: "Instructor ID is required" }, { status: 400 })
    }

    console.log("[v0] Creating assessment with:", {
      title,
      assessment_type,
      instructor_id,
      question_count: question_ids.length,
    })

    // Create the quiz/assessment
    const quizResult = await sql`
      INSERT INTO quizzes (
        title,
        description,
        time_limit,
        instructor_id,
        assessment_type,
        available_from,
        available_until,
        is_active,
        created_at
      ) VALUES (
        ${title},
        ${description || ""},
        ${time_limit || 60},
        ${instructor_id},
        ${assessment_type || "quiz"},
        ${available_from ? new Date(available_from) : new Date()},
        ${available_until ? new Date(available_until) : null},
        true,
        NOW()
      ) RETURNING id
    `

    const quizId = quizResult[0].id
    console.log("[v0] Created assessment with ID:", quizId)

    // Add questions to the quiz
    for (let i = 0; i < question_ids.length; i++) {
      const questionId = question_ids[i]
      const customTimeLimit = custom_time_limits?.[questionId]

      // Get question details from question bank
      const questionResult = await sql`
        SELECT 
          id,
          question_text,
          question_type,
          correct_answer,
          options,
          evaluation_mode,
          explanation,
          difficulty_level,
          topic,
          subtopic,
          subquestions,
          solution_upload_config
        FROM question_bank 
        WHERE id = ${questionId}
      `

      if (questionResult.length === 0) {
        console.log(`[v0] Warning: Question ${questionId} not found in question bank`)
        continue
      }

      const question = questionResult[0]
      const timeLimit =
        customTimeLimit ||
        DEFAULT_TIME_LIMITS[question.question_type] ||
        getDefaultTimeLimit(String(question.question_type || "mcq"))
      const linked = minimalBankLinkedQuizQuestionFields(question as Record<string, unknown>, {
        questionOrder: i + 1,
        timeLimit,
      })

      await sql`
        INSERT INTO quiz_questions (
          quiz_id,
          question_text,
          question_type,
          bank_question_id,
          question_order,
          time_limit,
          points,
          max_points,
          created_at
        ) VALUES (
          ${quizId},
          '',
          ${linked.question_type},
          ${linked.bank_question_id},
          ${linked.question_order},
          ${linked.time_limit},
          ${linked.points ?? 1},
          ${linked.max_points ?? 1},
          NOW()
        )
      `
    }

    // Notify students when a new assessment is posted
    const sendNotifications = body.sendNotifications !== false
    if (sendNotifications) {
      const students = await sql`SELECT id FROM students`
      if (students.length > 0) {
        const typeLabel = assessment_type === "quiz" ? "quiz" : assessment_type === "homework" ? "homework" : assessment_type === "mid_semester" || assessment_type === "midsem" ? "mid-semester exam" : assessment_type === "final" ? "final exam" : "assessment"
        const linkMap: Record<string, string> = {
          quiz: "/student/dashboard-v2/quizzes",
          homework: "/student/dashboard-v2/homework",
          mid_semester: "/student/dashboard-v2/mid-semester-exams",
          midsem: "/student/dashboard-v2/mid-semester-exams",
          final: "/student/dashboard-v2/final-exams",
        }
        const link = linkMap[assessment_type || "quiz"] ?? "/student/dashboard-v2/quizzes"
        const notifType = assessment_type === "mid_semester" || assessment_type === "midsem" || assessment_type === "final" ? "exam" : assessment_type === "homework" ? "homework" : "quiz"
        createBulkNotifications(
          students.map((s) => s.id),
          {
            type: notifType,
            title: `New ${typeLabel} available! 📝`,
            message: `A new ${typeLabel} "${title}" has been published. Check it out!`,
            link,
          },
        ).catch((err) => console.error("[Create-from-bank] Failed to send notifications:", err))
        const emailType = (assessment_type === "quiz" ? "quiz" : assessment_type === "homework" ? "homework" : assessment_type === "mid_semester" || assessment_type === "midsem" ? "mid-semester" : assessment_type === "final" ? "final" : "quiz") as "quiz" | "homework" | "mid-semester" | "final" | "code submission"
        sendNewAssessmentEmailsIfConfigured(
          students.map((s) => s.id),
          emailType,
          title,
          available_until ? new Date(available_until).toLocaleDateString("en-US", { dateStyle: "medium" }) : null
        )
      }
    }

    console.log("[v0] Successfully created instructor assessment from bank")
    return NextResponse.json({
      success: true,
      quizId,
      message: `${assessment_type || 'Assessment'} created successfully from question bank`,
    })
  } catch (error) {
    console.error("[v0] Failed to create instructor assessment from bank:", error)
    return NextResponse.json(
      { error: "Failed to create assessment from question bank" },
      { status: 500 }
    )
  }
}
