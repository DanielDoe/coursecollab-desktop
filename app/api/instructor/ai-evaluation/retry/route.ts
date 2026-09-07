import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { evaluateCode } from "@/lib/ai-evaluate-code"
import { ensureAiEvaluationSchema } from "@/lib/ensure-ai-evaluation-schema"
import { requireInstructorGradingAccess } from "@/lib/instructor-grading-auth"
import { resolveReferenceAnswerForAiGrading } from "@/lib/resolve-reference-answer-for-ai"


export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function POST(request: NextRequest) {
  try {
    await ensureAiEvaluationSchema(sql)

    const { evaluationId } = await request.json()

    if (!evaluationId) {
      return NextResponse.json({ error: "Evaluation ID required" }, { status: 400 })
    }

    const gradingAuth = await requireInstructorGradingAccess(request, { evaluationId: Number(evaluationId) })
    if (!gradingAuth.ok) return gradingAuth.response

    // Get the evaluation details
    const [evaluation] = await sql`
      SELECT 
        aeq.*,
        qq.question_text,
        qq.hint,
        qq.expected_answer
      FROM ai_evaluation_queue aeq
      JOIN quiz_questions qq ON aeq.question_id = qq.id
      WHERE aeq.id = ${evaluationId}
    `

    if (!evaluation) {
      return NextResponse.json({ error: "Evaluation not found" }, { status: 404 })
    }

    // Call evaluateCode directly (no internal HTTP fetch)
    const referenceAnswer = resolveReferenceAnswerForAiGrading({
      expected_answer: evaluation.expected_answer,
      correct_answer: evaluation.correct_answer,
    })

    const aiResult = await evaluateCode({
      questionType: evaluation.question_type || "code_write",
      questionText: evaluation.question_text || "",
      studentAnswer: evaluation.student_answer || "",
      correctAnswer: referenceAnswer ?? evaluation.correct_answer ?? undefined,
      rubric: evaluation.rubric || evaluation.hint || undefined,
      maxPoints: evaluation.max_points || 100,
      aiEvaluationMode: "relaxed",
    })

    if (!aiResult.requiresManualReview) {
      // AI evaluation succeeded - update the student's answer
      const scorePercentage = aiResult.score || 0
      const pointsEarned = (scorePercentage / 100) * evaluation.max_points

      // Update the quiz answer with the AI evaluation result
      await sql`
        UPDATE quiz_answers
        SET 
          is_correct = ${scorePercentage >= 70},
          ai_feedback = ${JSON.stringify(aiResult)},
          points_earned = ${pointsEarned},
          requires_review = false
        WHERE attempt_id = ${evaluation.attempt_id}
          AND question_id = ${evaluation.question_id}
      `

      // Update the quiz attempt score
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

      // Mark evaluation as completed
      await sql`
        UPDATE ai_evaluation_queue
        SET 
          status = 'completed',
          resolved_at = NOW(),
          retry_count = retry_count + 1
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

        console.log(`[AI Retry] Recalculated total score for attempt ${evaluation.attempt_id}: ${newTotalScore}`)
      } catch (recalcError) {
        console.error("[AI Retry] Failed to recalculate total score:", recalcError)
        // Don't fail the whole operation if recalculation fails
      }

      return NextResponse.json({
        success: true,
        score: scorePercentage,
        feedback: aiResult.feedback,
        pointsEarned: pointsEarned
      })
    } else {
      // AI still failed - update retry count (use 'failed' to match schema constraint)
      await sql`
        UPDATE ai_evaluation_queue
        SET 
          status = 'failed',
          retry_count = retry_count + 1,
          last_retried_at = NOW(),
          error_message = ${aiResult.fallbackReason || aiResult.errorType || 'AI evaluation failed'}
        WHERE id = ${evaluationId}
      `

      return NextResponse.json({
        success: false,
        message: "AI evaluation failed again. Please try manual grading.",
        error: aiResult.fallbackReason || aiResult.errorType
      }, { status: 500 })
    }

  } catch (error) {
    console.error("[AI Retry] Error:", error)
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : "Failed to retry AI evaluation" 
      },
      { status: 500 }
    )
  }
}

