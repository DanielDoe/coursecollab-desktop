import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

import { ensureAiEvaluationSchema } from "@/lib/ensure-ai-evaluation-schema"
import { requireInstructorGradingAccess } from "@/lib/instructor-grading-auth"


export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function POST(request: NextRequest) {
  try {
    await ensureAiEvaluationSchema(sql)

    const { evaluationId, score, feedback, maxPoints } = await request.json()

    if (!evaluationId || score === undefined || !feedback) {
      return NextResponse.json(
        { error: "Evaluation ID, score, and feedback are required" },
        { status: 400 }
      )
    }

    const gradingAuth = await requireInstructorGradingAccess(request, { evaluationId: Number(evaluationId) })
    if (!gradingAuth.ok) return gradingAuth.response

    // Validate score
    if (score < 0 || score > maxPoints) {
      return NextResponse.json(
        { error: `Score must be between 0 and ${maxPoints}` },
        { status: 400 }
      )
    }

    // Get the evaluation details
    const [evaluation] = await sql`
      SELECT *
      FROM ai_evaluation_queue
      WHERE id = ${evaluationId}
    `

    if (!evaluation) {
      return NextResponse.json({ error: "Evaluation not found" }, { status: 404 })
    }

    // Get instructor info from session
    const instructorSession = request.headers.get("authorization")
    // In a real implementation, parse the session to get instructor ID

    // Update the quiz answer with manual grade
    const scorePercentage = (score / maxPoints) * 100
    const isCorrect = scorePercentage >= 70
    const manualFeedback = {
      aiGraded: false,
      manuallyGraded: true,
      score: Number(scorePercentage.toFixed(2)),
      maxPoints,
      pointsEarned: score,
      feedback,
      status: "Instructor Review",
      statusMessage: "Score entered by instructor.",
      requiresManualReview: false,
      detailedExplanation: feedback,
      scoreBreakdown: {
        finalScore: Number(scorePercentage.toFixed(2)),
      },
    }

    await sql`
      UPDATE quiz_answers
      SET 
        is_correct = ${isCorrect},
        ai_feedback = ${JSON.stringify(manualFeedback)},
        points_earned = ${score},
        requires_review = false
      WHERE attempt_id = ${evaluation.attempt_id}
        AND question_id = ${evaluation.question_id}
    `

    // Recalculate the total attempt score
    const attemptAnswers = await sql`
      SELECT COALESCE(SUM(points_earned), 0) as total_points
      FROM quiz_answers
      WHERE attempt_id = ${evaluation.attempt_id}
    `

    const totalPoints = Number(attemptAnswers[0]?.total_points || 0)

    await sql`
      UPDATE quiz_attempts
      SET score = ${totalPoints}
      WHERE id = ${evaluation.attempt_id}
    `

    // Mark evaluation as resolved with manual grading flag
    await sql`
      UPDATE ai_evaluation_queue
      SET 
        status = 'resolved',
        resolved_at = NOW(),
        resolved_by = 0
      WHERE id = ${evaluationId}
    `

    // Recalculate the total score for this quiz attempt
    try {
      const scoreCalculation = await sql`
        SELECT 
          COUNT(*) as total_questions,
          SUM(COALESCE(qans.points_earned, 0)) as total_points_earned,
          COUNT(CASE WHEN qans.is_correct = true THEN 1 END) as correct_answers
        FROM quiz_questions qq
        LEFT JOIN quiz_answers qans ON qq.id = qans.question_id AND qans.attempt_id = ${evaluation.attempt_id}
        WHERE qq.quiz_id = (SELECT quiz_id FROM quiz_attempts WHERE id = ${evaluation.attempt_id})
      `

      const calc = scoreCalculation[0]
      const newTotalScore = parseFloat(calc.total_points_earned || 0)

      await sql`
        UPDATE quiz_attempts
        SET score = ${newTotalScore}
        WHERE id = ${evaluation.attempt_id}
      `

      console.log(`[Manual Grade] Recalculated total score for attempt ${evaluation.attempt_id}: ${newTotalScore}`)
    } catch (recalcError) {
      console.error("[Manual Grade] Failed to recalculate total score:", recalcError)
      // Don't fail the whole operation if recalculation fails
    }

    return NextResponse.json({
      success: true,
      score: score,
      scorePercentage: scorePercentage,
      feedback: feedback,
      message: "Manual grade submitted successfully"
    })

  } catch (error) {
    console.error("[Manual Grade] Error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to submit manual grade"
      },
      { status: 500 }
    )
  }
}

