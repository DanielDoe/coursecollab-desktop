import { NextRequest, NextResponse } from "next/server"
import { requireCronAuth } from "@/lib/compliance/cron-auth"
import { sql } from "@/lib/db"
import { autoFinalizeQuizAttemptsForQuiz } from "@/lib/auto-finalize-quiz-attempts"
import { normalizeQuizRetakePolicyForAutoFinalize } from "@/lib/retake-auto-finalize"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET(request: NextRequest) {
  try {
    // Verify this is a cron job request
    const cron = requireCronAuth(request)
    if (!cron.ok) return cron.response

    const now = new Date()

    // Expired quizzes with completed attempts still missing a reconciled final row.
    // 7-day lookback (was 24h) so a missed cron run does not skip finalization forever.
    const expiredQuizzes = await sql`
      SELECT 
        q.id,
        q.title,
        q.available_until,
        q.retake_policy,
        COUNT(qa.id) FILTER (WHERE qa.deleted_at IS NULL) as total_attempts,
        COUNT(qa.id) FILTER (
          WHERE qa.deleted_at IS NULL
            AND qa.completed_at IS NOT NULL
            AND qa.is_final_grade = false
        ) as pending_finalization
      FROM quizzes q
      LEFT JOIN quiz_attempts qa ON q.id = qa.quiz_id
      WHERE q.deleted_at IS NULL
        AND q.available_until < ${now.toISOString()}
        AND q.available_until > (${now.toISOString()}::timestamp - INTERVAL '7 days')
      GROUP BY q.id, q.title, q.available_until, q.retake_policy
      HAVING COUNT(qa.id) FILTER (
        WHERE qa.deleted_at IS NULL
          AND qa.completed_at IS NOT NULL
          AND qa.is_final_grade = false
      ) > 0
    `

    const results = []

    for (const quiz of expiredQuizzes) {
      try {
        const gradingPolicy = normalizeQuizRetakePolicyForAutoFinalize(
          quiz.retake_policy as string | null
        )

        const { finalizedCount, skippedCount } = await autoFinalizeQuizAttemptsForQuiz({
          quizId: Number(quiz.id),
          gradingPolicy,
          skipNotifications: true,
        })

        results.push({
          quizId: quiz.id,
          quizTitle: quiz.title,
          finalizedCount,
          skippedCount,
          gradingPolicy,
          totalAttempts: quiz.total_attempts,
          pendingFinalization: quiz.pending_finalization
        })

        console.log(`Auto-finalized ${finalizedCount} attempts for quiz "${quiz.title}" using ${gradingPolicy} policy`)

      } catch (error) {
        console.error(`Error auto-finalizing quiz ${quiz.id}:`, error)
        results.push({
          quizId: quiz.id,
          quizTitle: quiz.title,
          error: error instanceof Error ? error.message : 'Unknown error',
          finalizedCount: 0
        })
      }
    }

    const totalFinalized = results.reduce((sum, result) => sum + (result.finalizedCount || 0), 0)

    return NextResponse.json({
      success: true,
      message: `Auto-finalized attempts for ${expiredQuizzes.length} expired quizzes`,
      totalFinalized,
      results,
      processedAt: now.toISOString()
    })

  } catch (error) {
    console.error('Error in auto-finalize cron job:', error)
    return NextResponse.json(
      { error: 'Failed to auto-finalize expired quiz attempts' },
      { status: 500 }
    )
  }
}
