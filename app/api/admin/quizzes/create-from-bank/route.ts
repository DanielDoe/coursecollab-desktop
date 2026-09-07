import { type NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { sql } from "@/lib/db"
import { minimalBankLinkedQuizQuestionFields } from "@/lib/resolve-quiz-question-from-bank"
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
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    console.log("[v0] Starting quiz creation from bank")
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
    } = body

    // Validation
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

    console.log("[v0] Creating quiz with availability:", {
      available_from_input: available_from,
      available_from_utc: availableFromUTC,
      available_until_input: available_until,
      available_until_utc: availableUntilUTC,
      assessment_type: assessment_type || "quiz",
    })

    let assessmentTypeColumnExists = false
    try {
      await sql`SELECT assessment_type FROM quizzes LIMIT 1`
      assessmentTypeColumnExists = true
    } catch (error) {
      console.log("[v0] assessment_type column doesn't exist yet")
    }

    console.log("[v0] Creating quiz with title:", title)
    const [quiz] = assessmentTypeColumnExists
      ? await sql`
          INSERT INTO quizzes (
            title, 
            description, 
            created_by, 
            is_public, 
            time_per_question,
            available_from,
            available_until,
            assessment_type,
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
            ${assessment_type || "quiz"},
            NOW(), 
            NOW()
          )
          RETURNING id
        `
      : await sql`
          INSERT INTO quizzes (
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

    console.log("[v0] Quiz created with ID:", quiz.id)

    if (!question_ids || question_ids.length === 0) {
      console.log("[v0] No questions selected")
      await sql`DELETE FROM quizzes WHERE id = ${quiz.id}`
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
        options,
        correct_answer,
        hint,
        subquestions,
        solution_upload_config
      FROM question_bank
      WHERE id = ANY(${question_ids})
    `

    console.log("[v0] Selected questions count:", selectedQuestions?.length || 0)

    if (!selectedQuestions || selectedQuestions.length === 0) {
      console.log("[v0] No questions found, cleaning up quiz")
      await sql`DELETE FROM quizzes WHERE id = ${quiz.id}`
      return NextResponse.json({ error: "No questions found" }, { status: 400 })
    }

    console.log(`[v0] Linking ${selectedQuestions.length} bank questions (live content, no snapshot copy)...`)

    const insertedQuestions = []
    for (let i = 0; i < selectedQuestions.length; i++) {
      const q = selectedQuestions[i]
      const timeLimit =
        custom_time_limits?.[q.id] ??
        DEFAULT_TIME_LIMITS[q.question_type] ??
        getDefaultTimeLimit(String(q.question_type || "mcq"))
      const linked = minimalBankLinkedQuizQuestionFields(q as Record<string, unknown>, {
        questionOrder: i + 1,
        timeLimit,
      })

      const [inserted] = await sql`
        INSERT INTO quiz_questions (
          quiz_id,
          question_text,
          question_order,
          bank_question_id,
          time_limit,
          question_type,
          points,
          max_points,
          created_at
        ) VALUES (
          ${quiz.id},
          '',
          ${linked.question_order},
          ${linked.bank_question_id},
          ${linked.time_limit},
          ${linked.question_type},
          ${linked.points ?? 1},
          ${linked.max_points ?? 1},
          NOW()
        ) RETURNING id, bank_question_id
      `

      insertedQuestions.push(inserted)
    }

    if (!insertedQuestions || insertedQuestions.length === 0) {
      console.log("[v0] ERROR: Failed to insert questions, no rows returned")
      await sql`DELETE FROM quizzes WHERE id = ${quiz.id}`
      return NextResponse.json({ error: "Failed to insert questions into database" }, { status: 500 })
    }

    console.log(`[v0] Successfully inserted ${insertedQuestions.length} questions`)

    const verifyQuestions = await sql`
      SELECT id, TRIM(correct_answer) as correct_answer, question_type
      FROM quiz_questions
      WHERE quiz_id = ${quiz.id}
      LIMIT 3
    `
    console.log("[v0] VERIFICATION - First 3 questions stored in DB:")
    verifyQuestions.forEach((q) => {
      console.log(`[v0] Q${q.id} stored correct_answer: "${q.correct_answer}"`)
    })

    console.log("[v0] Batch inserting usage tracking records...")

    if (insertedQuestions.length > 0) {
      for (const row of insertedQuestions) {
        await sql`
          INSERT INTO question_bank_usage (quiz_id, bank_question_id, question_id, used_at)
          VALUES (${quiz.id}, ${row.bank_question_id}, ${row.id}, NOW())
        `
      }
      console.log("[v0] Usage tracking records inserted successfully")
    }

    console.log("[v0] Creating quiz session access for all sessions...")
    const allSessions = await sql`
      SELECT id FROM sessions
    `

    for (const session of allSessions) {
      await sql`
        INSERT INTO quiz_session_access (quiz_id, session_id, is_active, updated_at)
        VALUES (${quiz.id}, ${session.id}, true, CURRENT_TIMESTAMP)
        ON CONFLICT (quiz_id, session_id) DO NOTHING
      `
    }
    console.log(`[v0] Created session access for ${allSessions.length} sessions`)

    console.log("[v0] Quiz creation completed successfully")
    return NextResponse.json({
      success: true,
      quiz_id: quiz.id,
      questions_added: insertedQuestions.length,
      total_time_minutes: time_limit,
    })
  } catch (error) {
    console.error("[v0] Failed to create quiz from bank:", error)
    return NextResponse.json(
      {
        error: "Failed to create quiz",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
