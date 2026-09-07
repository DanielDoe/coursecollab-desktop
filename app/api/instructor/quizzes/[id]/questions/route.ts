import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { minimalBankLinkedQuizQuestionFields } from "@/lib/resolve-quiz-question-from-bank"
import { assertQuizAccessibleInCourse } from "@/lib/quiz-course-access"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    console.log("[v0] Starting add questions to quiz")
    const { id } = await params
    const { questionIds } = await request.json()
    const quizId = id

    const access = await assertQuizAccessibleInCourse(request, Number(quizId))
    if (!access.ok) return access.response

    console.log("[v0] Request body:", { quizId, questionIds })

    if (!questionIds || !Array.isArray(questionIds) || questionIds.length === 0) {
      console.log("[v0] Validation failed: Question IDs are required")
      return NextResponse.json({ error: "Question IDs are required" }, { status: 400 })
    }

    // Get the next question order
    const lastQuestion = await sql`
      SELECT question_order FROM quiz_questions 
      WHERE quiz_id = ${quizId} 
      ORDER BY question_order DESC 
      LIMIT 1
    `
    const nextOrder = lastQuestion.length > 0 ? lastQuestion[0].question_order + 1 : 1

    // Fetch questions from question bank
    console.log("[v0] Fetching specific questions:", questionIds)
    const bankQuestions = await sql`
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
      WHERE id = ANY(${questionIds})
    `
    console.log("[v0] Selected questions count:", bankQuestions?.length || 0)

    if (bankQuestions.length === 0) {
      console.log("[v0] No questions found in question bank for IDs:", questionIds)
      return NextResponse.json({ error: "No questions found in question bank" }, { status: 404 })
    }

    // Check if any of these questions are already in the quiz
    const existingQuestions = await sql`
      SELECT bank_question_id FROM quiz_questions 
      WHERE quiz_id = ${quizId} AND bank_question_id = ANY(${questionIds})
    `
    
    if (existingQuestions.length > 0) {
      console.log("[v0] Some questions already exist in quiz:", existingQuestions.map(q => q.bank_question_id))
      return NextResponse.json({ error: "Some questions are already in this quiz" }, { status: 400 })
    }

    // Insert questions into quiz
    const insertedQuestions = []
    for (let i = 0; i < bankQuestions.length; i++) {
      const q = bankQuestions[i]
      const linked = minimalBankLinkedQuizQuestionFields(q as Record<string, unknown>, {
        questionOrder: nextOrder + i,
        timeLimit: 60,
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
          ${quizId},
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

    // Track usage in question bank
    for (const row of insertedQuestions) {
      await sql`
        INSERT INTO question_bank_usage (quiz_id, bank_question_id, question_id, used_at)
        VALUES (${quizId}, ${row.bank_question_id}, ${row.id}, NOW())
      `
    }

    return NextResponse.json({ 
      success: true, 
      questions_added: insertedQuestions.length 
    })
  } catch (error) {
    console.error("[v0] Failed to add questions to quiz:", error)
    console.error("[v0] Error details:", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })
    return NextResponse.json({ 
      error: "Failed to add questions to quiz",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}
