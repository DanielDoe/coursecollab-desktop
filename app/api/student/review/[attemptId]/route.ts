import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function GET(request: NextRequest, { params }: { params: { attemptId: string } }) {
  try {
    const attemptId = params.attemptId

    // Get quiz title and attempt details
    const attemptResult = await sql`
      SELECT 
        q.title as quiz_title,
        q.id as quiz_id,
        qa.score,
        qa.total_questions,
        qa.completed_at,
        qa.attempt_number
      FROM quiz_attempts qa
      JOIN quizzes q ON qa.quiz_id = q.id
      WHERE qa.id = ${attemptId}
    `

    if (attemptResult.length === 0) {
      return NextResponse.json({ error: "Quiz attempt not found" }, { status: 404 })
    }

    const allQuestions = await sql`
      SELECT 
        qq.id as question_id,
        qq.question_text,
        qq.option_a,
        qq.option_b,
        qq.option_c,
        qq.option_d,
        qq.option_e,
        qq.correct_answer,
        qq.question_type,
        qq.hint,
        qq.explanation,
        qq.topic,
        qq.difficulty,
        COALESCE(qa.selected_answer, NULL) as selected_answer,
        COALESCE(qa.is_correct, false) as is_correct
      FROM quiz_questions qq
      LEFT JOIN quiz_answers qa ON qa.question_id = qq.id AND qa.attempt_id = ${attemptId}
      WHERE qq.quiz_id = ${attemptResult[0].quiz_id}
      ORDER BY qq.question_order ASC
    `

    return NextResponse.json({
      quiz_title: attemptResult[0].quiz_title,
      score: attemptResult[0].score,
      total_questions: attemptResult[0].total_questions,
      completed_at: attemptResult[0].completed_at,
      attempt_number: attemptResult[0].attempt_number,
      questions: allQuestions,
    })
  } catch (error) {
    console.error("[v0] Failed to fetch review questions:", error)
    return NextResponse.json({ error: "Failed to fetch review questions" }, { status: 500 })
  }
}
