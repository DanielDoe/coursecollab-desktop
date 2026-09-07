import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function GET(request: NextRequest) {
  try {
    // Verify instructor authentication
    const instructorSession = request.headers.get("authorization") || request.headers.get("x-instructor-id")
    if (!instructorSession) {
      return NextResponse.json({ error: "Instructor authentication required" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const assessmentId = searchParams.get("assessmentId")

    if (!assessmentId) {
      return NextResponse.json({ error: "Assessment ID is required" }, { status: 400 })
    }

    // Get assessment details
    const assessment = await sql`
      SELECT 
        id, title, description, assessment_type, created_at,
        time_per_question, is_public, retake_enabled, retake_limit
      FROM quizzes 
      WHERE id = ${assessmentId} AND deleted_at IS NULL
    `

    if (assessment.length === 0) {
      return NextResponse.json({ error: "Assessment not found" }, { status: 404 })
    }

    // Get attempt statistics
    const attemptStats = await sql`
      SELECT 
        COUNT(*) as total_attempts,
        COUNT(CASE WHEN completed_at IS NOT NULL THEN 1 END) as completed_attempts,
        COUNT(CASE WHEN completed_at IS NULL THEN 1 END) as incomplete_attempts,
        COUNT(DISTINCT student_id) as unique_students,
        COALESCE(AVG(score), 0) as average_score,
        COALESCE(MIN(score), 0) as min_score,
        COALESCE(MAX(score), 0) as max_score,
        COALESCE(STDDEV(score), 0) as score_std_dev
      FROM quiz_attempts
      WHERE quiz_id = ${assessmentId}
    `

    // Get score distribution
    const scoreDistribution = await sql`
      SELECT 
        CASE 
          WHEN score >= 90 THEN '90-100'
          WHEN score >= 80 THEN '80-89'
          WHEN score >= 70 THEN '70-79'
          WHEN score >= 60 THEN '60-69'
          WHEN score >= 50 THEN '50-59'
          ELSE 'Below 50'
        END as score_range,
        COUNT(*) as count
      FROM quiz_attempts
      WHERE quiz_id = ${assessmentId} AND score IS NOT NULL
      GROUP BY 
        CASE 
          WHEN score >= 90 THEN '90-100'
          WHEN score >= 80 THEN '80-89'
          WHEN score >= 70 THEN '70-79'
          WHEN score >= 60 THEN '60-69'
          WHEN score >= 50 THEN '50-59'
          ELSE 'Below 50'
        END
      ORDER BY 
        CASE 
          WHEN score_range = '90-100' THEN 1
          WHEN score_range = '80-89' THEN 2
          WHEN score_range = '70-79' THEN 3
          WHEN score_range = '60-69' THEN 4
          WHEN score_range = '50-59' THEN 5
          ELSE 6
        END
    `

    // Get question-wise performance
    const questionPerformance = await sql`
      SELECT 
        qq.id,
        qq.question_text,
        qq.topic,
        qq.difficulty,
        qq.question_type,
        COUNT(qa.id) as total_attempts,
        COUNT(CASE WHEN qa.is_correct = true THEN 1 END) as correct_attempts,
        ROUND(
          COUNT(CASE WHEN qa.is_correct = true THEN 1 END) * 100.0 / COUNT(qa.id), 
          2
        ) as accuracy_percentage,
        AVG(qa.time_spent) as avg_time_spent
      FROM quiz_questions qq
      LEFT JOIN quiz_answers qa ON qq.id = qa.question_id
      LEFT JOIN quiz_attempts qta ON qa.attempt_id = qta.id
      WHERE qq.quiz_id = ${assessmentId}
      GROUP BY qq.id, qq.question_text, qq.topic, qq.difficulty, qq.question_type
      ORDER BY qq.question_order
    `

    // Get student performance breakdown
    const studentPerformance = await sql`
      SELECT 
        s.id,
        s.first_name,
        s.last_name,
        s.session_code,
        qa.score,
        qa.attempted_at,
        qa.completed_at,
        qa.time_spent,
        qa.retake_count
      FROM quiz_attempts qa
      JOIN students s ON qa.student_id = s.id
      WHERE qa.quiz_id = ${assessmentId}
      ORDER BY qa.attempted_at DESC
    `

    // Get time-based trends
    const timeTrends = await sql`
      SELECT 
        DATE(attempted_at) as date,
        COUNT(*) as attempts,
        COUNT(CASE WHEN completed_at IS NOT NULL THEN 1 END) as completed,
        AVG(score) as avg_score,
        AVG(time_spent) as avg_time_spent
      FROM quiz_attempts
      WHERE quiz_id = ${assessmentId}
      GROUP BY DATE(attempted_at)
      ORDER BY date DESC
      LIMIT 30
    `

    // Get session-wise performance
    const sessionPerformance = await sql`
      SELECT 
        s.session_code,
        COUNT(qa.id) as attempts,
        COUNT(CASE WHEN qa.completed_at IS NOT NULL THEN 1 END) as completed,
        AVG(qa.score) as avg_score,
        COUNT(DISTINCT qa.student_id) as unique_students
      FROM quiz_attempts qa
      JOIN students s ON qa.student_id = s.id
      WHERE qa.quiz_id = ${assessmentId}
      GROUP BY s.session_code
      ORDER BY attempts DESC
    `

    // Get retake analysis
    const retakeAnalysis = await sql`
      SELECT 
        retake_count,
        COUNT(*) as attempts,
        AVG(score) as avg_score,
        MIN(score) as min_score,
        MAX(score) as max_score
      FROM quiz_attempts
      WHERE quiz_id = ${assessmentId} AND retake_count > 0
      GROUP BY retake_count
      ORDER BY retake_count
    `

    return NextResponse.json({
      success: true,
      assessment: assessment[0],
      attemptStats: attemptStats[0],
      scoreDistribution,
      questionPerformance,
      studentPerformance,
      timeTrends,
      sessionPerformance,
      retakeAnalysis
    })

  } catch (error) {
    console.error("[Assessment Analytics] Error:", error)
    return NextResponse.json(
      { error: "Failed to fetch assessment analytics" },
      { status: 500 }
    )
  }
}
