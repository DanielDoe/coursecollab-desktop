import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { calculateAttemptStats } from "@/lib/gradeUtils"

export const dynamic = 'force-dynamic'

/**
 * GET /api/quizzes/analytics
 * Get analytics for a specific quiz
 * Uses quizzes table directly (no assessment_type filter)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const quizId = searchParams.get("quizId")

    if (!quizId) {
      return NextResponse.json({ error: "Quiz ID is required" }, { status: 400 })
    }

    // Get quiz details
    const [quiz] = await sql`
      SELECT 
        id, title, description, created_at,
        time_per_question, is_public, retake_enabled, retake_limit
      FROM quizzes 
      WHERE id = ${Number(quizId)} AND deleted_at IS NULL
    `

    if (!quiz) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 })
    }

    // Get attempt statistics using shared utility
    const attemptStats = await calculateAttemptStats('quiz', Number(quizId))

    // Get question-level statistics
    const questionStats = await sql`
      SELECT 
        qq.id,
        qq.question_text,
        qq.question_type,
        COUNT(qa.id) as total_answers,
        COUNT(CASE WHEN qa.is_correct = true THEN 1 END) as correct_answers,
        ROUND(
          COUNT(CASE WHEN qa.is_correct = true THEN 1 END)::DECIMAL / 
          NULLIF(COUNT(qa.id), 0) * 100, 
          2
        ) as correct_percentage,
        AVG(qa.points_earned) as avg_points_earned
      FROM quiz_questions qq
      LEFT JOIN quiz_answers qa ON qq.id = qa.question_id
      LEFT JOIN quiz_attempts qat ON qa.attempt_id = qat.id
      WHERE qq.quiz_id = ${Number(quizId)}
      GROUP BY qq.id, qq.question_text, qq.question_type
      ORDER BY qq.question_order
    `

    // Get student-level statistics
    const studentStats = await sql`
      SELECT 
        s.id,
        s.full_name,
        s.student_id,
        s.section,
        COUNT(qa.id) as total_attempts,
        MAX(qa.score) as best_score,
        MAX(qa.completed_at) as last_attempt_date,
        AVG(qa.score) as avg_score
      FROM students s
      LEFT JOIN quiz_attempts qa ON s.id = qa.student_id AND qa.quiz_id = ${Number(quizId)}
      WHERE EXISTS (
        SELECT 1 FROM quiz_attempts qa2 
        WHERE qa2.student_id = s.id AND qa2.quiz_id = ${Number(quizId)}
      )
      GROUP BY s.id, s.full_name, s.student_id, s.section
      ORDER BY s.full_name
    `

    return NextResponse.json({
      quiz,
      attemptStats,
      questionStats,
      studentStats
    })
  } catch (error) {
    console.error("[Quiz Analytics] Error:", error)
    return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 })
  }
}

