import { type NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { sql } from "@/lib/db"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const attemptId = params.id
    const { questionIndex, newIsCorrect, manualAnswer } = await request.json()

    console.log("[v0] Manual correction request:", { attemptId, questionIndex, newIsCorrect, manualAnswer })

    const attempt = await sql`
      SELECT 
        qa.id as answer_id, 
        qa.question_id, 
        qa.is_correct as old_is_correct, 
        qa.selected_answer,
        q.id as question_db_id
      FROM quiz_attempts qat
      LEFT JOIN quiz_questions q ON q.quiz_id = qat.quiz_id
      LEFT JOIN quiz_answers qa ON qa.attempt_id = qat.id AND qa.question_id = q.id
      WHERE qat.id = ${attemptId}
      ORDER BY q.question_order ASC
    `

    console.log("[v0] Found", attempt.length, "questions for attempt", attemptId)

    if (!attempt || attempt.length === 0) {
      console.error("[v0] No attempt found for ID:", attemptId)
      return NextResponse.json({ error: "Attempt not found" }, { status: 404 })
    }

    if (questionIndex < 0 || questionIndex >= attempt.length) {
      console.error("[v0] Invalid question index:", questionIndex, "out of", attempt.length)
      return NextResponse.json({ error: "Invalid question index" }, { status: 400 })
    }

    const answerToUpdate = attempt[questionIndex]

    console.log("[v0] Answer to update:", {
      answerId: answerToUpdate.answer_id,
      questionId: answerToUpdate.question_id,
      questionDbId: answerToUpdate.question_db_id,
      oldIsCorrect: answerToUpdate.old_is_correct,
      newIsCorrect,
      oldAnswer: answerToUpdate.selected_answer,
      newAnswer: manualAnswer,
    })

    if (!answerToUpdate.answer_id) {
      console.log("[v0] Creating new answer record for unanswered question")

      await sql`
        INSERT INTO quiz_answers (attempt_id, question_id, selected_answer, is_correct, answered_at)
        VALUES (
          ${attemptId},
          ${answerToUpdate.question_db_id},
          ${manualAnswer},
          ${newIsCorrect},
          NOW()
        )
      `
    } else {
      await sql`
        UPDATE quiz_answers
        SET is_correct = ${newIsCorrect},
            selected_answer = ${manualAnswer !== null ? manualAnswer : answerToUpdate.selected_answer}
        WHERE id = ${answerToUpdate.answer_id}
      `
    }

    console.log("[v0] Answer updated successfully")

    // Recalculate the total score for this attempt
    const scoreResult = await sql`
      SELECT COUNT(*) FILTER (WHERE is_correct = true) as correct_count,
             COUNT(*) as total_count
      FROM quiz_answers
      WHERE attempt_id = ${attemptId}
    `

    const newScore = Number(scoreResult[0].correct_count)
    const totalQuestions = Number(scoreResult[0].total_count)
    const newPercentage = totalQuestions > 0 ? Math.round((newScore / totalQuestions) * 100) : 0

    console.log("[v0] Recalculated score:", { newScore, totalQuestions, newPercentage })

    // Update the quiz_attempts table with the new score
    await sql`
      UPDATE quiz_attempts
      SET score = ${newScore}
      WHERE id = ${attemptId}
    `

    console.log("[v0] Quiz attempt score updated successfully")

    return NextResponse.json({
      success: true,
      newScore,
      totalQuestions,
      newPercentage,
    })
  } catch (error) {
    console.error("[v0] Error correcting answer:", error)
    console.error("[v0] Error stack:", error instanceof Error ? error.stack : "No stack trace")
    console.error("[v0] Error message:", error instanceof Error ? error.message : String(error))

    return NextResponse.json(
      {
        error: "Failed to correct answer",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
