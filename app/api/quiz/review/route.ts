import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"



// GET – Fetch all answers needing review
export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function GET() {
  try {
    console.log("[v0] Fetching pending reviews...")

    const rows = await sql`
      SELECT 
        qa.id AS answer_id,
        qq.quiz_id,
        qa.question_id,
        qq.question_text,
        qq.question_type,
        qat.student_id,
        COALESCE(NULLIF(qa.selected_answer, ''), NULLIF(qa.answer_data, ''), qa.answer_data, qa.selected_answer) AS given_answer,
        qa.feedback,
        qa.is_correct,
        qa.override_points,
        qa.requires_review,
        qa.override_comment,
        qa.reviewed_by,
        qa.reviewed_at,
        q.title AS quiz_title,
        qat.id AS attempt_id,
        qat.score AS current_score,
        qat.total_questions
      FROM quiz_answers qa
      JOIN quiz_questions qq ON qa.question_id = qq.id
      JOIN quizzes q ON qq.quiz_id = q.id
      JOIN quiz_attempts qat ON qa.attempt_id = qat.id
      WHERE qa.requires_review = true
      ORDER BY qa.answered_at DESC
    `

    console.log("[v0] Found", rows.length, "pending reviews")

    return NextResponse.json({ pending: rows })
  } catch (err) {
    console.error("[v0] ❌ Review fetch failed:", err)
    return NextResponse.json({ error: "Failed to fetch reviews" }, { status: 500 })
  }
}

// PATCH – Instructor overrides score and marks reviewed
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { answerId, overridePoints, overrideComment, reviewedBy } = body

    console.log("[v0] Updating review:", { answerId, overridePoints, reviewedBy })

    // Update the answer with instructor's override
    await sql`
      UPDATE quiz_answers
      SET 
        override_points = ${overridePoints},
        override_comment = ${overrideComment},
        requires_review = false,
        reviewed_by = ${reviewedBy},
        reviewed_at = NOW(),
        is_correct = ${overridePoints > 0}
      WHERE id = ${answerId}
    `

    // Recalculate the quiz attempt score using actual points_earned
    const result = await sql`
      WITH answer_scores AS (
        SELECT 
          attempt_id,
          COALESCE(override_points, points_earned, 0) AS points
        FROM quiz_answers
        WHERE attempt_id = (SELECT attempt_id FROM quiz_answers WHERE id = ${answerId})
      )
      UPDATE quiz_attempts
      SET score = (SELECT SUM(points) FROM answer_scores)
      WHERE id = (SELECT attempt_id FROM quiz_answers WHERE id = ${answerId})
      RETURNING score, total_questions
    `

    console.log("[v0] Review updated successfully. New score:", result[0])

    return NextResponse.json({ success: true, newScore: result[0] })
  } catch (err) {
    console.error("[v0] ❌ Review update failed:", err)
    return NextResponse.json({ error: "Failed to update review" }, { status: 500 })
  }
}
