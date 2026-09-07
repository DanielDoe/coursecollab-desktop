import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requirePracticeAttemptOwnership } from "@/lib/require-student-practice-auth"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function POST(request: NextRequest) {
  try {
    const { attemptId, questionId, answer, isCorrect, timeSpent } = await request.json()

    if (!attemptId || !questionId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const auth = await requirePracticeAttemptOwnership(request, Number(attemptId))
    if (!auth.ok) return auth.response

    await sql`
      INSERT INTO practice_answers (
        attempt_id,
        bank_question_id,
        student_answer,
        is_correct,
        time_spent_seconds
      )
      VALUES (
        ${attemptId},
        ${questionId},
        ${typeof answer === "object" ? JSON.stringify(answer) : answer},
        ${isCorrect},
        ${timeSpent}
      )
    `

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Error saving practice answer:", error)
    return NextResponse.json({ error: "Failed to save answer" }, { status: 500 })
  }
}
