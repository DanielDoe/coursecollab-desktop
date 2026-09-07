import { sql } from "@/lib/db"
import { finalizePracticeAttempt } from "@/lib/practice-attempt-update"
import { loadPracticeAttemptById } from "@/lib/practice-attempt-load"

export type PracticeFinalizeResult = {
  success: true
  score: number
  correctCount: number
  totalQuestions: number
} | {
  success: false
  error: string
  status: number
}

/** Finalize a practice attempt from saved practice_answers (shared by submit + auto-complete). */
export async function finalizePracticeAttemptFromSavedAnswers(
  attemptId: number,
  studentDbId: number,
): Promise<PracticeFinalizeResult> {
  const attempt = await loadPracticeAttemptById(attemptId, studentDbId)
  if (!attempt) {
    return { success: false, error: "Practice attempt not found", status: 404 }
  }

  const savedAnswers = await sql`
    SELECT is_correct FROM practice_answers WHERE attempt_id = ${attemptId}
  `

  if (savedAnswers.length === 0) {
    return {
      success: false,
      error: "No answers were saved for this practice session.",
      status: 400,
    }
  }

  const correctCount = savedAnswers.filter((a) => a.is_correct).length
  const totalQuestions = savedAnswers.length
  const score = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0

  if (attempt.completed_at == null) {
    const rawStarted = attempt.started_at ?? attempt.created_at ?? new Date()
    const startedAt = rawStarted instanceof Date ? rawStarted.toISOString() : String(rawStarted)
    await finalizePracticeAttempt({
      attemptId,
      correctCount,
      score,
      startedAt,
    })

    try {
      await sql`SELECT update_practice_leaderboard(${studentDbId}, ${score}, ${totalQuestions})`
    } catch {
      /* non-critical */
    }
  }

  return { success: true, score, correctCount, totalQuestions }
}
