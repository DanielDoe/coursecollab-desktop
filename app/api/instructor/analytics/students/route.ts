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
    const studentId = searchParams.get("studentId")
    const sessionCode = searchParams.get("sessionCode")

    // Build query conditions
    let whereClause = "1=1"
    let params: any[] = []

    if (studentId) {
      whereClause += " AND s.id = $" + (params.length + 1)
      params.push(studentId)
    }

    if (sessionCode) {
      whereClause += " AND s.session_code = $" + (params.length + 1)
      params.push(sessionCode)
    }

    // Get student overview
    const studentOverview = await sql`
      SELECT 
        s.id,
        s.first_name,
        s.last_name,
        s.session_code,
        s.email,
        COUNT(DISTINCT qa.id) as total_attempts,
        COUNT(DISTINCT CASE WHEN qa.completed_at IS NOT NULL THEN qa.id END) as completed_attempts,
        COUNT(DISTINCT q.id) as assessments_taken,
        COALESCE(AVG(qa.score), 0) as average_score,
        COALESCE(MIN(qa.score), 0) as lowest_score,
        COALESCE(MAX(qa.score), 0) as highest_score,
        COALESCE(STDDEV(qa.score), 0) as score_std_dev
      FROM students s
      LEFT JOIN quiz_attempts qa ON s.id = qa.student_id
      LEFT JOIN quizzes q ON qa.quiz_id = q.id AND q.deleted_at IS NULL
      WHERE ${sql.unsafe(whereClause)}
      GROUP BY s.id, s.first_name, s.last_name, s.session_code, s.email
      ORDER BY average_score DESC
    `

    // Get performance by assessment type
    const performanceByType = await sql`
      SELECT 
        q.assessment_type,
        COUNT(qa.id) as attempts,
        COUNT(CASE WHEN qa.completed_at IS NOT NULL THEN 1 END) as completed,
        AVG(qa.score) as avg_score,
        MIN(qa.score) as min_score,
        MAX(qa.score) as max_score
      FROM students s
      LEFT JOIN quiz_attempts qa ON s.id = qa.student_id
      LEFT JOIN quizzes q ON qa.quiz_id = q.id AND q.deleted_at IS NULL
      WHERE ${sql.unsafe(whereClause)}
      GROUP BY s.id, q.assessment_type
      ORDER BY avg_score DESC
    `

    // Get performance by topic
    const performanceByTopic = await sql`
      SELECT 
        qq.topic,
        COUNT(qa.id) as attempts,
        COUNT(CASE WHEN qa.is_correct = true THEN 1 END) as correct_attempts,
        ROUND(
          COUNT(CASE WHEN qa.is_correct = true THEN 1 END) * 100.0 / COUNT(qa.id), 
          2
        ) as accuracy_percentage,
        AVG(qa.time_spent) as avg_time_spent
      FROM students s
      LEFT JOIN quiz_attempts qta ON s.id = qta.student_id
      LEFT JOIN quiz_answers qa ON qta.id = qa.attempt_id
      LEFT JOIN quiz_questions qq ON qa.question_id = qq.id
      LEFT JOIN quizzes q ON qta.quiz_id = q.id AND q.deleted_at IS NULL
      WHERE ${sql.unsafe(whereClause)}
      GROUP BY s.id, qq.topic
      ORDER BY accuracy_percentage DESC
    `

    // Get performance by difficulty
    const performanceByDifficulty = await sql`
      SELECT 
        qq.difficulty,
        COUNT(qa.id) as attempts,
        COUNT(CASE WHEN qa.is_correct = true THEN 1 END) as correct_attempts,
        ROUND(
          COUNT(CASE WHEN qa.is_correct = true THEN 1 END) * 100.0 / COUNT(qa.id), 
          2
        ) as accuracy_percentage,
        AVG(qa.time_spent) as avg_time_spent
      FROM students s
      LEFT JOIN quiz_attempts qta ON s.id = qta.student_id
      LEFT JOIN quiz_answers qa ON qta.id = qa.attempt_id
      LEFT JOIN quiz_questions qq ON qa.question_id = qq.id
      LEFT JOIN quizzes q ON qta.quiz_id = q.id AND q.deleted_at IS NULL
      WHERE ${sql.unsafe(whereClause)}
      GROUP BY s.id, qq.difficulty
      ORDER BY 
        CASE qq.difficulty 
          WHEN 'easy' THEN 1 
          WHEN 'medium' THEN 2 
          WHEN 'hard' THEN 3 
          ELSE 4 
        END
    `

    // Get time-based trends
    const timeTrends = await sql`
      SELECT 
        DATE(qa.attempted_at) as date,
        COUNT(qa.id) as attempts,
        AVG(qa.score) as avg_score,
        AVG(qa.time_spent) as avg_time_spent
      FROM students s
      LEFT JOIN quiz_attempts qa ON s.id = qa.student_id
      LEFT JOIN quizzes q ON qa.quiz_id = q.id AND q.deleted_at IS NULL
      WHERE ${sql.unsafe(whereClause)}
      GROUP BY s.id, DATE(qa.attempted_at)
      ORDER BY date DESC
      LIMIT 30
    `

    // Get recent activity
    const recentActivity = await sql`
      SELECT 
        qa.id,
        q.title as quiz_title,
        q.assessment_type,
        qa.score,
        qa.attempted_at,
        qa.completed_at,
        qa.time_spent,
        qa.retake_count
      FROM students s
      LEFT JOIN quiz_attempts qa ON s.id = qa.student_id
      LEFT JOIN quizzes q ON qa.quiz_id = q.id AND q.deleted_at IS NULL
      WHERE ${sql.unsafe(whereClause)}
      ORDER BY qa.attempted_at DESC
      LIMIT 20
    `

    // Get session comparison
    const sessionComparison = await sql`
      SELECT 
        s.session_code,
        COUNT(DISTINCT s.id) as total_students,
        COUNT(qa.id) as total_attempts,
        AVG(qa.score) as avg_score,
        COUNT(DISTINCT q.id) as assessments_taken
      FROM students s
      LEFT JOIN quiz_attempts qa ON s.id = qa.student_id
      LEFT JOIN quizzes q ON qa.quiz_id = q.id AND q.deleted_at IS NULL
      GROUP BY s.session_code
      ORDER BY avg_score DESC
    `

    // Get struggling areas (topics with low performance)
    const strugglingAreas = await sql`
      SELECT 
        qq.topic,
        COUNT(qa.id) as attempts,
        ROUND(
          COUNT(CASE WHEN qa.is_correct = true THEN 1 END) * 100.0 / COUNT(qa.id), 
          2
        ) as accuracy_percentage
      FROM students s
      LEFT JOIN quiz_attempts qta ON s.id = qta.student_id
      LEFT JOIN quiz_answers qa ON qta.id = qa.attempt_id
      LEFT JOIN quiz_questions qq ON qa.question_id = qq.id
      LEFT JOIN quizzes q ON qta.quiz_id = q.id AND q.deleted_at IS NULL
      WHERE ${sql.unsafe(whereClause)}
      GROUP BY s.id, qq.topic
      HAVING COUNT(qa.id) > 0 AND 
             ROUND(COUNT(CASE WHEN qa.is_correct = true THEN 1 END) * 100.0 / COUNT(qa.id), 2) < 60
      ORDER BY accuracy_percentage ASC
      LIMIT 10
    `

    // Get strengths (topics with high performance)
    const strengths = await sql`
      SELECT 
        qq.topic,
        COUNT(qa.id) as attempts,
        ROUND(
          COUNT(CASE WHEN qa.is_correct = true THEN 1 END) * 100.0 / COUNT(qa.id), 
          2
        ) as accuracy_percentage
      FROM students s
      LEFT JOIN quiz_attempts qta ON s.id = qta.student_id
      LEFT JOIN quiz_answers qa ON qta.id = qa.attempt_id
      LEFT JOIN quiz_questions qq ON qa.question_id = qq.id
      LEFT JOIN quizzes q ON qta.quiz_id = q.id AND q.deleted_at IS NULL
      WHERE ${sql.unsafe(whereClause)}
      GROUP BY s.id, qq.topic
      HAVING COUNT(qa.id) > 0 AND 
             ROUND(COUNT(CASE WHEN qa.is_correct = true THEN 1 END) * 100.0 / COUNT(qa.id), 2) >= 80
      ORDER BY accuracy_percentage DESC
      LIMIT 10
    `

    return NextResponse.json({
      success: true,
      studentOverview,
      performanceByType,
      performanceByTopic,
      performanceByDifficulty,
      timeTrends,
      recentActivity,
      sessionComparison,
      strugglingAreas,
      strengths
    })

  } catch (error) {
    console.error("[Student Analytics] Error:", error)
    return NextResponse.json(
      { error: "Failed to fetch student analytics" },
      { status: 500 }
    )
  }
}
