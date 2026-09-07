import { type NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { sql } from "@/lib/db"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const { id } = await params
    const quizId = id

    console.log("[Admin Quiz DELETE] Soft deleting quiz ID:", quizId)

    const quizInfo = await sql`
      SELECT parent_quiz_id, is_saved, deleted_at FROM quizzes WHERE id = ${quizId}
    `

    if (quizInfo.length === 0) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 })
    }

    const { parent_quiz_id, is_saved, deleted_at } = quizInfo[0]

    // Check if already soft deleted
    if (deleted_at) {
      return NextResponse.json({ error: "Quiz is already deleted" }, { status: 400 })
    }

    // check if there are any active quizzes using this as a parent
    if (is_saved && !parent_quiz_id) {
      const childQuizzes = await sql`
        SELECT COUNT(*) as count FROM quizzes WHERE parent_quiz_id = ${quizId} AND deleted_at IS NULL
      `

      if (childQuizzes[0].count > 0) {
        return NextResponse.json(
          { error: "Cannot delete saved template that has active quizzes using it" },
          { status: 400 },
        )
      }
    }

    // Get admin info for deleted_by
    const adminSession = request.headers.get('admin-session')
    let deletedBy = 'admin'
    if (adminSession) {
      try {
        const adminInfo = await sql`
          SELECT username FROM admin_users WHERE session = ${adminSession}
        `
        if (adminInfo.length > 0) {
          deletedBy = adminInfo[0].username
        }
      } catch (error) {
        console.log("Could not get admin username:", error)
      }
    }

    // Soft delete quiz by setting deleted_at timestamp
    await sql`
      UPDATE quizzes 
      SET deleted_at = NOW(), deleted_by = ${deletedBy}
      WHERE id = ${quizId}
    `

    console.log("[Admin Quiz DELETE] Successfully soft deleted quiz:", quizId)

    return NextResponse.json({ 
      success: true,
      message: "Quiz moved to trash successfully"
    })
  } catch (error) {
    console.error("[v0] Failed to delete quiz:", error)
    return NextResponse.json({ error: "Failed to delete quiz" }, { status: 500 })
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const { id } = await params
    const quizId = id

    // Get quiz details
    const quizResult = await sql`
      SELECT * FROM quizzes WHERE id = ${quizId}
    `

    if (quizResult.length === 0) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 })
    }

    const questions = await sql`
      SELECT 
        id,
        quiz_id,
        question_text,
        question_order,
        option_a,
        option_b,
        option_c,
        option_d,
        option_e,
        TRIM(correct_answer) as correct_answer,
        bank_question_id,
        time_limit,
        question_type,
        COALESCE(max_points, points, 1) as max_points,
        COALESCE(points, max_points, 1) as points,
        created_at,
        sample_answers,
        ai_code_language
      FROM quiz_questions
      WHERE quiz_id = ${quizId}
      ORDER BY question_order ASC
    `

    console.log(`[v0] Fetched ${questions.length} questions for quiz ${quizId}`)
    if (questions.length > 0) {
      const firstQuestion = questions[0]
      console.log(`[v0] First question correct_answer:`, firstQuestion.correct_answer)
      console.log(`[v0] First question correct_answer type:`, typeof firstQuestion.correct_answer)
      console.log(`[v0] First question correct_answer length:`, firstQuestion.correct_answer?.length)
      console.log(`[v0] First question correct_answer JSON:`, JSON.stringify(firstQuestion.correct_answer))
    }

    return NextResponse.json({
      quiz: quizResult[0],
      questions,
    })
  } catch (error) {
    console.error("[v0] Failed to fetch quiz:", error)
    return NextResponse.json({ error: "Failed to fetch quiz" }, { status: 500 })
  }
}
