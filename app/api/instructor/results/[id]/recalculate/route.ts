import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireInstructorAttemptAccess } from "@/lib/instructor-results-auth"
import { recalculateAttemptScore, RecalculateRateLimitError } from "@/lib/recalculate-score"

export const dynamic = "force-dynamic"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const access = await requireInstructorAttemptAccess(request, id)
    if (!access.ok) return access.response

    const body = await request.json().catch(() => ({}))
    const quizIdRaw = body.quizId
    const quizId = quizIdRaw != null ? Number(quizIdRaw) : NaN

    const attempt = await sql`
      SELECT quiz_id FROM quiz_attempts
      WHERE id = ${access.attemptId} AND deleted_at IS NULL
      LIMIT 1
    `
    if (attempt.length === 0) {
      return NextResponse.json({ error: "Attempt not found" }, { status: 404 })
    }
    const resolvedQuizId = Number((attempt[0] as { quiz_id: number }).quiz_id)
    if (Number.isFinite(quizId) && quizId !== resolvedQuizId) {
      return NextResponse.json({ error: "Attempt not found" }, { status: 404 })
    }

    const recalc = await recalculateAttemptScore(access.attemptId, resolvedQuizId)
    return NextResponse.json({
      success: true,
      attemptId: recalc.attemptId,
      score: recalc.score,
      percentage: recalc.totalPossiblePoints > 0
        ? Math.round((recalc.score / recalc.totalPossiblePoints) * 10000) / 100
        : 0,
      correctCount: recalc.correctCount,
      actualPointsEarned: recalc.actualPointsEarned,
      totalPossiblePoints: recalc.totalPossiblePoints,
      totalQuestions: recalc.totalQuestions,
      answeredCount: recalc.answeredCount,
      recalculated: true,
    })
  } catch (error) {
    if (error instanceof RecalculateRateLimitError) {
      return NextResponse.json(
        { error: error.message, retryAfterMs: error.retryAfterMs },
        { status: 429 },
      )
    }
    console.error("[Results Recalculate] Error:", error)
    return NextResponse.json({ error: "Failed to recalculate score" }, { status: 500 })
  }
}
