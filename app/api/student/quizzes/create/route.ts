import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireCallerStudentDbId } from "@/lib/student-api-auth"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function POST(request: NextRequest) {
  try {
    const { title, description, time_per_question, is_public, questions } = await request.json()

    const auth = await requireCallerStudentDbId(request)
    if (!auth.ok) return auth.response
    const studentId = auth.studentDbId

    // Create user quiz
    const quizResult = await sql`
      INSERT INTO user_quizzes (title, description, time_per_question, is_public, created_by)
      VALUES (${title}, ${description}, ${time_per_question}, ${is_public}, ${studentId})
      RETURNING id
    `

    const quizId = quizResult[0].id

    // Insert questions
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i]

      await sql`
        INSERT INTO user_quiz_questions (
          user_quiz_id, question_text, question_type, option_a, option_b, option_c, option_d, option_e,
          correct_answer, question_order, time_limit
        )
        VALUES (
          ${quizId}, ${q.question_text}, ${q.question_type}, ${q.option_a || null}, ${q.option_b || null}, 
          ${q.option_c || null}, ${q.option_d || null}, ${q.option_e || null},
          ${q.correct_answer}, ${i + 1}, ${q.time_limit || null}
        )
      `
    }

    return NextResponse.json({ quizId })
  } catch (error) {
    console.error("[v0] Failed to create user quiz:", error)
    return NextResponse.json({ error: "Failed to create quiz" }, { status: 500 })
  }
}
