import { type NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { sql } from "@/lib/db"



export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    // question_bank uses JSON options field, so we skip it
    const quizQuestions = await sql`
      SELECT 
        id,
        'quiz_questions' as table_name,
        quiz_id,
        question_text,
        correct_answer,
        option_a,
        option_b,
        option_c,
        option_d,
        option_e,
        CASE 
          WHEN correct_answer ~ '^[A-E]$' THEN 'needs_fix'
          WHEN correct_answer ~ '^\\[.*\\]$' THEN 'fixed'
          ELSE 'unknown'
        END as status
      FROM quiz_questions
      WHERE question_type = 'select_all'
      ORDER BY quiz_id, id
    `

    const allQuestions = quizQuestions.map((q) => ({
      id: q.id,
      table: q.table_name,
      quiz_id: q.quiz_id,
      question_text: q.question_text,
      correct_answer: q.correct_answer,
      option_a: q.option_a,
      option_b: q.option_b,
      option_c: q.option_c,
      option_d: q.option_d,
      option_e: q.option_e,
      status: q.status,
    }))

    return NextResponse.json({ questions: allQuestions })
  } catch (error) {
    console.error("[v0] Failed to audit select_all questions:", error)
    return NextResponse.json({ error: "Failed to audit questions" }, { status: 500 })
  }
}
