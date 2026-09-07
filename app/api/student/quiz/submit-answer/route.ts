import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function POST(request: NextRequest) {
  try {
    const { studentId, quizId, questionId, answer } = await request.json()

    if (!studentId || !quizId || !questionId || !answer) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Get the correct answer for this question
    const questionResult = await sql`
      SELECT correct_answer
      FROM questions
      WHERE id = ${questionId} AND quiz_id = ${quizId}
    `

    if (questionResult.length === 0) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 })
    }

    const correctAnswer = questionResult[0].correct_answer
    const isCorrect = answer === correctAnswer

    return NextResponse.json({
      isCorrect,
      correctAnswer,
    })
  } catch (error) {
    console.error("[v0] Failed to check answer:", error)
    return NextResponse.json({ error: "Failed to check answer" }, { status: 500 })
  }
}
