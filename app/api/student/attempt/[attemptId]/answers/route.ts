import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getAssessmentConfig, normalizeAssessmentType, type AssessmentType } from "@/lib/assessment-core/db"
import { requireAttemptOwnership } from "@/lib/student-api-auth"
import { resolveSelectAllCorrectLetters } from "@/lib/practice-answer-review"
import {
  QUIZ_QUESTION_BANK_JOIN,
  QUIZ_QUESTION_BANK_SELECT,
  resolveQuizQuestionFromBank,
} from "@/lib/resolve-quiz-question-from-bank"

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
        qa.question_id as "questionId",
        qa.selected_answer as "answer",
        qa.answer_data as "answerData",
        qa.points_earned as "pointsEarned",
        qa.is_correct as "isCorrect",
        qa.ai_feedback as "aiFeedback",
        qq.question_type as "questionType",
        qq.option_a as "optionA",
        qq.option_b as "optionB",
        qq.option_c as "optionC",
        qq.option_d as "optionD",
        qq.option_e as "optionE",
        qq.correct_answer as "correctAnswer",
        qq.bank_question_id as "bankQuestionId",
        ${sql.unsafe(QUIZ_QUESTION_BANK_SELECT.replace(/\n/g, " "))}
      FROM ${sql.unsafe(config.answersTable)} qa
      JOIN quiz_questions qq ON qq.id = qa.question_id
      ${sql.unsafe(QUIZ_QUESTION_BANK_JOIN)}
      WHERE qa.attempt_id = ${attemptId}
      ORDER BY qa.question_id
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

      const qType = String(row.questionType ?? "").toLowerCase()
      let correctLetters: string[] | undefined
      const feedbackLetters = Array.isArray(aiFeedback?.correctLetters)
        ? (aiFeedback.correctLetters as unknown[]).map(String).filter(Boolean)
        : []
      if (feedbackLetters.length > 0) {
        correctLetters = feedbackLetters
      } else if (
        (qType === "select_all" || qType === "multi_output") &&
        row.pointsEarned != null
      ) {
        const resolved = resolveQuizQuestionFromBank({
          option_a: row.optionA,
          option_b: row.optionB,
          option_c: row.optionC,
          option_d: row.optionD,
          option_e: row.optionE,
          correct_answer: row.correctAnswer,
          bank_question_id: row.bankQuestionId,
          question_type: row.questionType,
          bank_question_text: row.bank_question_text,
          bank_question_type: row.bank_question_type,
          bank_options: row.bank_options,
          bank_correct_answer: row.bank_correct_answer,
          bank_hint: row.bank_hint,
          bank_explanation: row.bank_explanation,
          bank_evaluation_mode: row.bank_evaluation_mode,
          bank_sample_answer: row.bank_sample_answer,
          bank_expected_answer: row.bank_expected_answer,
          bank_answer_guidelines: row.bank_answer_guidelines,
          bank_question_media: row.bank_question_media,
          bank_subquestions: row.bank_subquestions,
          bank_solution_upload_config: row.bank_solution_upload_config,
          bank_topic: row.bank_topic,
          bank_difficulty: row.bank_difficulty,
        } as Record<string, unknown>)
        const letters = resolveSelectAllCorrectLetters({
          option_a: resolved.option_a,
          option_b: resolved.option_b,
          option_c: resolved.option_c,
          option_d: resolved.option_d,
          option_e: resolved.option_e,
          correct_answer: resolved.correct_answer,
        })
        correctLetters = letters.length > 0 ? letters : undefined
      }

      return {
        questionId: row.questionId,
        answer: answer,
        answerData: row.answerData ?? null,
        pointsEarned: row.pointsEarned != null ? Number(row.pointsEarned) : undefined,
        isCorrect: row.isCorrect ?? undefined,
        aiFeedback,
        correctLetters,
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
