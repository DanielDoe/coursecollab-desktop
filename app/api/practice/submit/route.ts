import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requirePracticeAttemptOwnership } from "@/lib/require-student-practice-auth"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function POST(request: NextRequest) {
  try {
    const { attemptId, answers } = await request.json()

    const auth = await requirePracticeAttemptOwnership(request, Number(attemptId))
    if (!auth.ok) return auth.response

    // Get attempt details
    const [attempt] = await sql`
      SELECT * FROM practice_attempts WHERE id = ${attemptId}
    `

    if (!attempt) {
      return NextResponse.json({ error: "Attempt not found" }, { status: 404 })
    }

    // Calculate score
    let correctCount = 0
    const totalQuestions = answers.length

    for (const answer of answers) {
      const isCorrect = answer.is_correct
      if (isCorrect) correctCount++

      // Save answer
      await sql`
        INSERT INTO practice_answers (
          attempt_id,
          question_id,
          selected_answer,
          is_correct
        ) VALUES (
          ${attemptId},
          ${answer.question_id},
          ${answer.selected_answer},
          ${isCorrect}
        )
      `
    }

    const score = (correctCount / totalQuestions) * 100

    // Update attempt
    await sql`
      UPDATE practice_attempts
      SET 
        score = ${score},
        completed_at = CURRENT_TIMESTAMP
      WHERE id = ${attemptId}
    `

    await sql`SELECT update_practice_leaderboard(${attempt.student_id}, ${score}, ${totalQuestions})`

    void (async () => {
      try {
        const { recordPracticeAnalytics } = await import("@/lib/institutions/learning-analytics")
        const courseRows = await sql`SELECT course_id FROM students WHERE id = ${attempt.student_id} LIMIT 1`
        await recordPracticeAnalytics({
          studentId: Number(attempt.student_id),
          attemptId: Number(attemptId),
          courseId: courseRows[0]?.course_id != null ? Number(courseRows[0].course_id) : null,
          score,
          correctCount,
          totalQuestions,
          completed: true,
        })
      } catch {
        /* non-blocking */
      }
    })()

    return NextResponse.json({
      success: true,
      score,
      correctCount,
      totalQuestions,
    })
  } catch (error) {
    console.error("[v0] Failed to submit practice:", error)
    return NextResponse.json({ error: "Failed to submit practice" }, { status: 500 })
  }
}
