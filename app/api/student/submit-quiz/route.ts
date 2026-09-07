import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

import { verifyAnswerLocally, canVerifyLocally } from "@/lib/local-answer-verification"


export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function POST(request: NextRequest) {
  try {
    const { studentId, quizId, answers } = await request.json()

    if (!studentId || !quizId || !answers) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Check if student already attempted this quiz
    const existingAttempt = await sql`
      SELECT id FROM quiz_attempts
      WHERE student_id = ${studentId} AND quiz_id = ${quizId}
    `

    if (existingAttempt.length > 0) {
      return NextResponse.json({ error: "You have already attempted this quiz" }, { status: 400 })
    }

    // Get all questions with correct answers and options
    const questions = await sql`
      SELECT id, correct_answer, question_type, option_a, option_b, option_c, option_d, option_e
      FROM quiz_questions
      WHERE quiz_id = ${quizId}
    `

    // Calculate score
    let score = 0
    const studentAnswers = []

    for (const question of questions) {
      const selectedAnswer = answers[question.id] || null
      
      let isCorrect = false
      
      // Use local verification if possible
      if (canVerifyLocally(question.question_type)) {
        const questionData = {
          correctAnswer: question.correct_answer,
          options: {
            A: question.option_a,
            B: question.option_b,
            C: question.option_c,
            D: question.option_d,
            E: question.option_e
          }
        }
        
        const result = verifyAnswerLocally(question.question_type, selectedAnswer, questionData)
        isCorrect = result.score > 0
      } else {
        // Fallback to simple comparison
        isCorrect = selectedAnswer === question.correct_answer
      }

      if (isCorrect) score++

      studentAnswers.push({
        questionId: question.id,
        selectedAnswer,
        isCorrect,
      })
    }

    // Create quiz attempt
    const attemptResult = await sql`
      INSERT INTO quiz_attempts (student_id, quiz_id, score, total_questions)
      VALUES (${studentId}, ${quizId}, ${score}, ${questions.length})
      RETURNING id
    `

    const attemptId = attemptResult[0].id

    // Save individual answers
    for (const answer of studentAnswers) {
      await sql`
        INSERT INTO student_answers (attempt_id, question_id, selected_answer, is_correct)
        VALUES (${attemptId}, ${answer.questionId}, ${answer.selectedAnswer}, ${answer.isCorrect})
      `
    }

    return NextResponse.json({
      attemptId,
      score,
      totalQuestions: questions.length,
    })
  } catch (error) {
    console.error("[v0] Failed to submit quiz:", error)
    return NextResponse.json({ error: "Failed to submit quiz" }, { status: 500 })
  }
}
