import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const quizId = searchParams.get("quizId")
    const studentId = searchParams.get("studentId")

    if (!quizId || !studentId) {
      return NextResponse.json(
        { error: "Missing quizId or studentId" },
        { status: 400 }
      )
    }

    console.log("[LatestAttempt] Fetching latest attempt for quiz:", quizId, "student:", studentId)

    // Get the final grade attempt (respects retake policy) or fallback to most recent
    // CRITICAL: Only return COMPLETED attempts - incomplete attempts have no answers/score
    const attempts = await sql`
      SELECT id, score, total_questions, completed_at, started_at, is_final_grade
      FROM quiz_attempts
      WHERE quiz_id = ${quizId}
        AND student_id = ${studentId}
        AND completed_at IS NOT NULL
        AND deleted_at IS NULL
      ORDER BY 
        CASE WHEN is_final_grade = true THEN 0 ELSE 1 END,
        completed_at DESC, 
        id DESC
      LIMIT 1
    `

    if (attempts.length === 0) {
      console.log("[LatestAttempt] No attempts found")
      return NextResponse.json(
        { error: "No attempts found for this homework" },
        { status: 404 }
      )
    }

    const attempt = attempts[0]
    console.log("[LatestAttempt] Found attempt:", attempt.id)

    return NextResponse.json({
      attemptId: attempt.id,
      score: attempt.score,
      totalQuestions: attempt.total_questions,
      completedAt: attempt.completed_at,
      startedAt: attempt.started_at
    })

  } catch (error) {
    console.error("[LatestAttempt] Error:", error)
    return NextResponse.json(
      { error: "Failed to fetch attempt" },
      { status: 500 }
    )
  }
}

