import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireCallerStudentDbId } from "@/lib/student-api-auth"
import { stripHiddenAssessmentFields } from "@/lib/security/dto"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireCallerStudentDbId(request)
    if (!auth.ok) return auth.response
    const quizId = params.id

    if (isNaN(Number(quizId))) {
      return NextResponse.json({ error: "Invalid quiz ID" }, { status: 400 })
    }

    // Fetch quiz details
    const quizResult = await sql`
      SELECT 
        uq.*,
        s.full_name as creator_name
      FROM user_quizzes uq
      JOIN students s ON uq.created_by = s.id
      WHERE uq.id = ${quizId}
    `

    if (quizResult.length === 0) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 })
    }

    const quiz = quizResult[0]
    const isOwner = Number(quiz.created_by) === auth.studentDbId
    if (!isOwner && quiz.is_public !== true) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Fetch questions
    const questions = await sql`
      SELECT *
      FROM user_quiz_questions
      WHERE user_quiz_id = ${quizId}
      ORDER BY question_order ASC
    `

    const safeQuestions = isOwner
      ? questions
      : questions.map((q) => stripHiddenAssessmentFields(q as Record<string, unknown>))

    return NextResponse.json({ quiz, questions: safeQuestions })
  } catch (error) {
    console.error("[v0] Failed to fetch quiz:", error)
    return NextResponse.json({ error: "Failed to fetch quiz" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const quizId = params.id

    if (isNaN(Number(quizId))) {
      return NextResponse.json({ error: "Invalid quiz ID" }, { status: 400 })
    }

    const auth = await requireCallerStudentDbId(request)
    if (!auth.ok) return auth.response
    const studentId = auth.studentDbId

    // Verify ownership
    const quizResult = await sql`
      SELECT created_by
      FROM user_quizzes
      WHERE id = ${quizId}
    `

    if (quizResult.length === 0) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 })
    }

    if (Number(quizResult[0].created_by) !== studentId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Delete quiz (cascade will handle questions and attempts)
    await sql`
      DELETE FROM user_quizzes
      WHERE id = ${quizId}
    `

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Failed to delete quiz:", error)
    return NextResponse.json({ error: "Failed to delete quiz" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const quizId = params.id

    if (isNaN(Number(quizId))) {
      return NextResponse.json({ error: "Invalid quiz ID" }, { status: 400 })
    }

    const { title, description, time_per_question, is_public, questions } = await request.json()
    const auth = await requireCallerStudentDbId(request)
    if (!auth.ok) return auth.response
    const studentId = auth.studentDbId

    // Verify ownership
    const quizResult = await sql`
      SELECT created_by
      FROM user_quizzes
      WHERE id = ${quizId}
    `

    if (quizResult.length === 0) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 })
    }

    if (Number(quizResult[0].created_by) !== studentId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Update quiz
    await sql`
      UPDATE user_quizzes
      SET 
        title = ${title},
        description = ${description},
        time_per_question = ${time_per_question},
        is_public = ${is_public},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${quizId}
    `

    // Delete existing questions
    await sql`
      DELETE FROM user_quiz_questions
      WHERE user_quiz_id = ${quizId}
    `

    // Insert new questions
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i]

      await sql`
        INSERT INTO user_quiz_questions (
          user_quiz_id, question_text, question_type, option_a, option_b, option_c, option_d, 
          correct_answer, question_order, time_limit
        )
        VALUES (
          ${quizId}, ${q.question_text}, ${q.question_type}, ${q.option_a || null}, ${q.option_b || null}, 
          ${q.option_c || null}, ${q.option_d || null}, ${q.correct_answer}, ${i + 1}, ${q.time_limit || null}
        )
      `
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Failed to update quiz:", error)
    return NextResponse.json({ error: "Failed to update quiz" }, { status: 500 })
  }
}
