import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

import { createNotification } from "@/lib/create-notification"


export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function POST(request: NextRequest) {
  try {
    const { attemptId, questionId, hintPenalty } = await request.json()

    if (!attemptId || !questionId || hintPenalty === undefined) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Record hint usage
    await sql`
      INSERT INTO hint_usage (attempt_id, question_id, hint_penalty, used_at)
      VALUES (${attemptId}, ${questionId}, ${hintPenalty}, NOW())
      ON CONFLICT (attempt_id, question_id) 
      DO NOTHING
    `

    // Apply penalty to the attempt score
    await sql`
      UPDATE quiz_attempts
      SET score = GREATEST(0, score - ${hintPenalty})
      WHERE id = ${attemptId}
    `

    const attemptInfo = await sql`
      SELECT qa.student_id, q.title as quiz_title
      FROM quiz_attempts qa
      JOIN quizzes q ON qa.quiz_id = q.id
      WHERE qa.id = ${attemptId}
    `

    if (attemptInfo.length > 0) {
      await createNotification({
        studentId: attemptInfo[0].student_id,
        type: "quiz",
        title: "Hint Used 💡",
        message: `You used a hint on "${attemptInfo[0].quiz_title}". ${hintPenalty} points have been deducted from your score.`,
        link: `/student/quiz/${attemptId}`,
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Failed to record hint usage:", error)
    return NextResponse.json({ error: "Failed to record hint usage" }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const attemptId = searchParams.get("attemptId")

    if (!attemptId) {
      return NextResponse.json({ error: "Missing attemptId" }, { status: 400 })
    }

    const hints = await sql`
      SELECT question_id, hint_penalty
      FROM hint_usage
      WHERE attempt_id = ${attemptId}
    `

    const usedHints = hints.map((h) => h.question_id)

    return NextResponse.json({ usedHints })
  } catch (error) {
    console.error("[v0] Failed to get hint usage:", error)
    return NextResponse.json({ error: "Failed to get hint usage" }, { status: 500 })
  }
}
