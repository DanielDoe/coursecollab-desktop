import { NextResponse } from "next/server"
import { sql } from "@/lib/db"

export const dynamic = "force-dynamic"

/**
 * GET /api/debug/quiz-answers-recent
 * Returns recent quiz_answers from the app's database (to verify table has data).
 */
export async function GET() {
  try {
    const total = await sql`
      SELECT COUNT(*)::int as count FROM quiz_answers
    `
    const recent = await sql`
      SELECT id, attempt_id, question_id, answered_at,
             selected_answer IS NOT NULL AND selected_answer::text != '' as has_selected,
             answer_data IS NOT NULL as has_answer_data,
             points_earned, is_correct
      FROM quiz_answers
      ORDER BY answered_at DESC NULLS LAST, id DESC
      LIMIT 30
    `
    const byAttempt = await sql`
      SELECT attempt_id, COUNT(*)::int as cnt
      FROM quiz_answers
      GROUP BY attempt_id
      ORDER BY attempt_id DESC
      LIMIT 20
    `
    return NextResponse.json({
      total_quiz_answers: total[0]?.count ?? 0,
      recent_rows: recent as any[],
      by_attempt: byAttempt as any[],
    })
  } catch (e) {
    console.error("[debug/quiz-answers-recent]", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 }
    )
  }
}
