import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getAssessmentConfig, normalizeAssessmentType, type AssessmentType } from "@/lib/assessment-core/db"
import { requireAttemptOwnership } from "@/lib/student-api-auth"

export const dynamic = 'force-dynamic'
export const runtime = "nodejs"

/**
 * GET /api/student/attempt/[attemptId]/answers
 * 
 * Retrieve all saved answers for an attempt
 * Used to restore answers when quiz is reloaded
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  try {
    const { attemptId: attemptIdParam } = await params
    const attemptId = parseInt(attemptIdParam)

    if (!attemptId || isNaN(attemptId)) {
      return NextResponse.json(
        { error: "Invalid attempt ID" },
        { status: 400 }
      )
    }

    const ownership = await requireAttemptOwnership(request, attemptId)
    if (!ownership.ok) return ownership.response

    // Get attempt to determine assessment type
    // Note: quiz_attempts table doesn't have assessment_type column, only quizzes table has it
    const attemptResult = await sql`
      SELECT 
        a.id,
        q.assessment_type as quiz_assessment_type
      FROM quiz_attempts a
      LEFT JOIN quizzes q ON a.quiz_id = q.id
      WHERE a.id = ${attemptId}
      LIMIT 1
    `

    if (attemptResult.length === 0) {
      return NextResponse.json(
        { error: "Attempt not found" },
        { status: 404 }
      )
    }

    const attempt = attemptResult[0]
    
    // Normalize assessment type using shared function
    const normalizedType = normalizeAssessmentType(attempt.quiz_assessment_type)
    
    const config = getAssessmentConfig(normalizedType)
    
    // Fetch all saved answers for this attempt
    const answersResult = await sql`
      SELECT 
        question_id as "questionId",
        selected_answer as "answer",
        answer_data as "answerData",
        points_earned as "pointsEarned",
        is_correct as "isCorrect",
        ai_feedback as "aiFeedback"
      FROM ${sql.unsafe(config.answersTable)}
      WHERE attempt_id = ${attemptId}
      ORDER BY question_id
    `

    const answers = answersResult.map((row: any) => {
      // Prioritize selected_answer (this is what auto-save stores)
      // Fallback to answer_data if selected_answer is null/empty
      let answer = row.answer || null
      
      // If selected_answer is empty, try to extract from answer_data
      if (!answer && row.answerData) {
        try {
          const data = typeof row.answerData === 'string' 
            ? JSON.parse(row.answerData) 
            : row.answerData
          
          if (data && data.answer !== undefined) {
            answer = data.answer
          }
        } catch (e) {
          // Use selected_answer if parsing fails
        }
      }
      
      let aiFeedback = row.aiFeedback ?? null
      if (typeof aiFeedback === "string") {
        try {
          aiFeedback = JSON.parse(aiFeedback)
        } catch {
          aiFeedback = null
        }
      }

      return {
        questionId: row.questionId,
        answer: answer,
        answerData: row.answerData ?? null,
        pointsEarned: row.pointsEarned != null ? Number(row.pointsEarned) : undefined,
        isCorrect: row.isCorrect ?? undefined,
        aiFeedback,
      }
    })

    return NextResponse.json(answers)
  } catch (error: any) {
    console.error("[Restore Answers] Error:", error)
    return NextResponse.json(
      { 
        error: error.message || "Failed to restore answers"
      },
      { status: 500 }
    )
  }
}
