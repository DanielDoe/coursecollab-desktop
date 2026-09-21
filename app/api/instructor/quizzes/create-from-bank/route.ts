import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { minimalBankLinkedQuizQuestionFields } from "@/lib/resolve-quiz-question-from-bank"
import { getDefaultTimeLimit } from "@/lib/config/quizSettings"
import { parseClientAvailabilityToUtcIso, utcIsoToDbTimestamp } from "@/lib/timezone"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import { applyDefaultIntegrityFlagsForNewAssessment } from "@/lib/apply-assessment-integrity-defaults"



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

    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response
    const instructorId = scope.instructorId
    const courseId = scope.course.id

    const availableFromUTC = utcIsoToDbTimestamp(parseClientAvailabilityToUtcIso(available_from))
    const availableUntilUTC = utcIsoToDbTimestamp(parseClientAvailabilityToUtcIso(available_until))

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
    const resolvedCourseId = Number.isFinite(courseId) ? courseId : null

    async function insertQuizRow(createdBy: number | null) {
      return assessmentTypeColumnExists
        ? await sql`
            INSERT INTO quizzes (
              title,
              description,
              created_by,
              course_id,
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
              ${createdBy},
              ${resolvedCourseId},
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
              course_id,
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
              ${createdBy},
              ${resolvedCourseId},
              true,
              ${time_limit || 30},
              ${availableFromUTC},
              ${availableUntilUTC},
              NOW(),
              NOW()
            )
            RETURNING id
          `
    }

    async function resolveAdminCreatedBy(): Promise<number | null> {
      const linked = await sql`
        SELECT a.id
        FROM admin_users a
        INNER JOIN instructors i ON lower(trim(a.email)) = lower(trim(i.email))
        WHERE i.id = ${instructorId}
        LIMIT 1
      `
      if (linked[0]?.id != null) return Number(linked[0].id)
      const anyAdmin = await sql`SELECT id FROM admin_users ORDER BY id ASC LIMIT 1`
      return anyAdmin[0]?.id != null ? Number(anyAdmin[0].id) : null
    }

    let quiz: { id: number }
    try {
      ;[quiz] = await insertQuizRow(instructorId)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (!message.includes("created_by") && !message.includes("foreign key")) throw error
      const adminCreatedBy = await resolveAdminCreatedBy()
      if (adminCreatedBy == null) throw error
      ;[quiz] = await insertQuizRow(adminCreatedBy)
    }

    console.log("[v0] Quiz created with ID:", quiz.id)
    await applyDefaultIntegrityFlagsForNewAssessment(quiz.id, assessment_type || "quiz")

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
        options::text as options,
        correct_answer::text as correct_answer,
        hint,
        question_media,
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

    console.log("[v0] Preparing batch insert for all questions...")

    console.log(`[v0] Linking ${selectedQuestions.length} bank questions (live content, no snapshot copy)...`)

    if (selectedQuestions.length === 0) {
      console.log("[v0] No valid questions to insert, cleaning up quiz")
      await sql`DELETE FROM quizzes WHERE id = ${quiz.id}`
      return NextResponse.json({ error: "No valid questions found" }, { status: 400 })
    }

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
      const answerSnapshot = String(q.correct_answer ?? " ").trim() || " "

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
          correct_answer,
          created_at
        ) VALUES (
          ${quiz.id},
          ${String(q.question_text ?? " ")},
          ${linked.question_order},
          ${linked.bank_question_id},
          ${linked.time_limit},
          ${linked.question_type},
          ${linked.points ?? 1},
          ${linked.max_points ?? 1},
          ${answerSnapshot},
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

    console.log("[v0] Batch inserting usage tracking records...")

    if (insertedQuestions.length > 0) {
      try {
        for (const row of insertedQuestions) {
          await sql`
            INSERT INTO question_bank_usage (quiz_id, bank_question_id, question_id, used_at)
            VALUES (${quiz.id}, ${row.bank_question_id}, ${row.id}, NOW())
          `
        }
        console.log("[v0] Usage tracking records inserted successfully")
      } catch (usageError) {
        console.error("[v0] question_bank_usage insert skipped:", usageError)
      }
    }

    console.log("[v0] Creating quiz session access...")
    const scopedSessions =
      Number.isFinite(courseId)
        ? await sql`
            SELECT id FROM sessions WHERE course_id = ${courseId}
          `
        : await sql`
            SELECT id FROM sessions
          `

    for (const session of scopedSessions) {
      await sql`
        INSERT INTO quiz_session_access (quiz_id, session_id, is_active, updated_at)
        VALUES (${quiz.id}, ${session.id}, false, CURRENT_TIMESTAMP)
        ON CONFLICT (quiz_id, session_id) DO NOTHING
      `
    }
    console.log(`[v0] Created session access for ${scopedSessions.length} sessions`)

    console.log("[v0] Quiz creation completed successfully")
    return NextResponse.json({
      success: true,
      quiz_id: quiz.id,
      questions_added: insertedQuestions.length,
      total_time_minutes: time_limit,
    })
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error)
    console.error("[v0] Failed to create quiz from bank:", error)
    return NextResponse.json(
      {
        error: details || "Failed to create quiz",
        details,
      },
      { status: 500 },
    )
  }
}
