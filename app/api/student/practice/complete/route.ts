import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

import { createNotification } from "@/lib/create-notification"
import { requirePracticeAttemptOwnership } from "@/lib/require-student-practice-auth"


export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function POST(request: NextRequest) {
  try {
    const { attemptId } = await request.json()
    const auth = await requirePracticeAttemptOwnership(request, Number(attemptId))
    if (!auth.ok) return auth.response
    const studentIdHeader = String(auth.studentDbId)

    // Get attempt details
    const attemptResult = await sql`
      SELECT 
        pa.correct_answers,
        pa.total_questions,
        pa.topics,
        pa.difficulty
      FROM practice_attempts pa
      WHERE pa.id = ${attemptId}
    `

    if (attemptResult.length === 0) {
      return NextResponse.json({ error: "Attempt not found" }, { status: 404 })
    }

    const attempt = attemptResult[0]
    const percentage = Math.round((attempt.correct_answers / attempt.total_questions) * 100)
    const topicsStr = attempt.topics?.join(", ") || "various topics"

    // Create notification for practice completion
    await createNotification({
      studentId: studentIdHeader,
      type: "practice",
      title: "Practice Session Complete! 📝",
      message: `You scored ${percentage}% on ${topicsStr} (${attempt.difficulty} difficulty)`,
      link: "/student/practice",
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Failed to complete practice:", error)
    return NextResponse.json({ error: "Failed to complete practice" }, { status: 500 })
  }
}
