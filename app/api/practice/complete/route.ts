import { type NextRequest, NextResponse } from "next/server"
import { finalizePracticeAttempt } from "@/lib/practice-attempt-update"
import { loadPracticeAttemptTiming } from "@/lib/practice-attempt-load"
import { requirePracticeAttemptOwnership } from "@/lib/require-student-practice-auth"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function POST(request: NextRequest) {
  try {
    const { attemptId, correctAnswers, timeSpent } = await request.json()

    if (!attemptId) {
      return NextResponse.json({ error: "Attempt ID is required" }, { status: 400 })
    }

    const auth = await requirePracticeAttemptOwnership(request, Number(attemptId))
    if (!auth.ok) return auth.response

    const attempt = await loadPracticeAttemptTiming(attemptId)
    if (!attempt) {
      return NextResponse.json({ error: "Attempt not found" }, { status: 404 })
    }

    const startedAt = attempt.started_at ?? attempt.created_at ?? new Date()
    await finalizePracticeAttempt({
      attemptId,
      correctCount: correctAnswers,
      score: 0,
      startedAt,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Error completing practice:", error)
    return NextResponse.json({ error: "Failed to complete practice" }, { status: 500 })
  }
}
