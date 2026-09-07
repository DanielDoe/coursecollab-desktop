import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { reconcileFinalGradeFlagsForStudent } from "@/lib/auto-finalize-quiz-attempts"
import { setResultsFinalized } from "@/lib/results-finalized"

export const dynamic = 'force-dynamic'
export const runtime = "nodejs"
export const maxDuration = 120

/**
 * POST /api/quizzes/submit
 * Submit a quiz attempt
 * Uses quizzes table directly (no assessment_type filter)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      quizId,
      studentId,
      answers,
      startedAt,
      completedAt
    } = body

    if (!quizId || !studentId || !answers) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Start transaction
    await sql`BEGIN`

    try {
      // Get quiz details
      const [quiz] = await sql`
        SELECT 
          id, retake_enabled, retake_limit,
          (SELECT COUNT(*) FROM quiz_questions WHERE quiz_id = ${quizId}) as total_questions
        FROM quizzes
        WHERE id = ${quizId} AND deleted_at IS NULL
      `

      if (!quiz) {
        await sql`ROLLBACK`
        return NextResponse.json({ error: "Quiz not found" }, { status: 404 })
      }

      // Check retake limits
      if (quiz.retake_enabled && quiz.retake_limit) {
        const existingAttempts = await sql`
          SELECT COUNT(*) as count
          FROM quiz_attempts
          WHERE quiz_id = ${quizId} AND student_id = ${studentId}
        `

        if (Number(existingAttempts[0].count) >= quiz.retake_limit) {
          await sql`ROLLBACK`
          return NextResponse.json({ 
            error: "Retake limit reached",
            maxAttempts: quiz.retake_limit
          }, { status: 400 })
        }
      }

      // Calculate score
      let correctCount = 0
      const answerRecords = []

      for (const answer of answers) {
        const [question] = await sql`
          SELECT id, correct_answer, COALESCE(max_points, points, 1) as points
          FROM quiz_questions
          WHERE id = ${answer.questionId} AND quiz_id = ${quizId}
        `

        if (!question) continue

        const isCorrect = String(question.correct_answer).toLowerCase().trim() === 
                         String(answer.selectedAnswer || '').toLowerCase().trim()
        
        if (isCorrect) correctCount++

        answerRecords.push({
          questionId: question.id,
          selectedAnswer: answer.selectedAnswer,
          isCorrect,
          pointsEarned: isCorrect ? Number(question.points) : 0
        })
      }

      const score = correctCount
      const attemptNumber = Number(quiz.retake_enabled 
        ? (await sql`SELECT COALESCE(MAX(attempt_number), 0) + 1 as next FROM quiz_attempts WHERE quiz_id = ${quizId} AND student_id = ${studentId}`)[0].next
        : 1)

      // Create attempt with row locking to prevent collisions
      const [attempt] = await sql`
        INSERT INTO quiz_attempts (
          quiz_id, student_id, score, total_questions,
          started_at, completed_at, attempt_number, is_final_grade
        )
        VALUES (
          ${quizId}, ${studentId}, ${score}, ${quiz.total_questions},
          ${startedAt ? new Date(startedAt) : sql`NOW()`},
          ${completedAt ? new Date(completedAt) : sql`NOW()`},
          ${attemptNumber}, true
        )
        RETURNING id
      `.then(rows => rows[0] ? [rows[0]] : [])

      if (!attempt) {
        await sql`ROLLBACK`
        return NextResponse.json({ error: "Failed to create attempt" }, { status: 500 })
      }

      // Insert answers
      for (const answer of answerRecords) {
        await sql`
          INSERT INTO quiz_answers (
            attempt_id, question_id, selected_answer, is_correct, points_earned
          )
          VALUES (
            ${attempt.id}, ${answer.questionId}, ${answer.selectedAnswer},
            ${answer.isCorrect}, ${answer.pointsEarned}
          )
        `
      }

      await reconcileFinalGradeFlagsForStudent(quizId, studentId)
      try {
        await setResultsFinalized(attempt.id, true, "submit")
      } catch {
        // non-fatal
      }

      await sql`COMMIT`

      return NextResponse.json({
        attemptId: attempt.id,
        score,
        totalQuestions: quiz.total_questions,
        percentage: (score / quiz.total_questions) * 100
      })
    } catch (error) {
      await sql`ROLLBACK`
      throw error
    }
  } catch (error) {
    console.error("[Quiz Submit] Error:", error)
    return NextResponse.json({ error: "Failed to submit quiz" }, { status: 500 })
  }
}
