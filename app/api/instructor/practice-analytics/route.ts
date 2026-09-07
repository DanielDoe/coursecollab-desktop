import { type NextRequest, NextResponse } from "next/server"
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
    const timeRange = searchParams.get("timeRange") || "7d"
    const topic = searchParams.get("topic")
    const difficulty = searchParams.get("difficulty")

    // Calculate date range
    const now = new Date()
    let startDate: Date
    
    switch (timeRange) {
      case "24h":
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        break
      case "7d":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case "30d":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    }

    // Build dynamic query conditions
    let whereConditions = [`pa.created_at >= '${startDate.toISOString()}'`]
    let queryParams: any[] = [startDate.toISOString()]

    if (topic) {
      whereConditions.push("pa.topics @> $2")
      queryParams.push(`["${topic}"]`)
    }

    if (difficulty) {
      whereConditions.push("pa.difficulty = $3")
      queryParams.push(difficulty)
    }

    const whereClause = whereConditions.join(" AND ")

    // Overall statistics
    const overallStats = await sql`
      SELECT 
        COUNT(DISTINCT pa.id)::INTEGER as total_attempts,
        COUNT(DISTINCT pa.student_id)::INTEGER as unique_students,
        COALESCE(AVG(pa.score), 0)::NUMERIC as average_score,
        COALESCE(AVG(pa.correct_answers), 0)::NUMERIC as average_correct,
        COALESCE(AVG(pa.total_questions), 0)::NUMERIC as average_questions
      FROM practice_attempts pa
      WHERE ${sql.raw(whereClause.replace(/\$\d+/g, (match) => {
        const index = parseInt(match.substring(1)) - 1
        return `$${index + 1}`
      }))}
      AND pa.completed_at IS NOT NULL
    `

    // Performance by topic
    const topicStats = await sql`
      SELECT 
        UNNEST(pa.topics) as topic,
        COUNT(*)::INTEGER as attempt_count,
        COUNT(DISTINCT pa.student_id)::INTEGER as unique_students,
        COALESCE(AVG(pa.score), 0)::NUMERIC as average_score,
        COALESCE(AVG(pa.correct_answers), 0)::NUMERIC as average_correct
      FROM practice_attempts pa
      WHERE ${sql.raw(whereClause.replace(/\$\d+/g, (match) => {
        const index = parseInt(match.substring(1)) - 1
        return `$${index + 1}`
      }))}
      AND pa.completed_at IS NOT NULL
      AND pa.topics IS NOT NULL
      GROUP BY UNNEST(pa.topics)
      ORDER BY attempt_count DESC
      LIMIT 10
    `

    // Performance by difficulty
    const difficultyStats = await sql`
      SELECT 
        pa.difficulty,
        COUNT(*)::INTEGER as attempt_count,
        COUNT(DISTINCT pa.student_id)::INTEGER as unique_students,
        COALESCE(AVG(pa.score), 0)::NUMERIC as average_score,
        COALESCE(AVG(pa.correct_answers), 0)::NUMERIC as average_correct
      FROM practice_attempts pa
      WHERE ${sql.raw(whereClause.replace(/\$\d+/g, (match) => {
        const index = parseInt(match.substring(1)) - 1
        return `$${index + 1}`
      }))}
      AND pa.completed_at IS NOT NULL
      GROUP BY pa.difficulty
      ORDER BY 
        CASE pa.difficulty 
          WHEN 'easy' THEN 1 
          WHEN 'medium' THEN 2 
          WHEN 'hard' THEN 3 
          ELSE 4 
        END
    `

    // Daily practice trends
    const dailyTrends = await sql`
      SELECT 
        DATE(pa.created_at) as practice_date,
        COUNT(*)::INTEGER as attempts,
        COUNT(DISTINCT pa.student_id)::INTEGER as unique_students,
        COALESCE(AVG(pa.score), 0)::NUMERIC as average_score
      FROM practice_attempts pa
      WHERE ${sql.raw(whereClause.replace(/\$\d+/g, (match) => {
        const index = parseInt(match.substring(1)) - 1
        return `$${index + 1}`
      }))}
      AND pa.completed_at IS NOT NULL
      GROUP BY DATE(pa.created_at)
      ORDER BY practice_date DESC
      LIMIT 30
    `

    // Top performing students
    const topStudents = await sql`
      SELECT 
        s.id,
        s.name,
        s.email,
        COUNT(pa.id)::INTEGER as total_attempts,
        COALESCE(AVG(pa.score), 0)::NUMERIC as average_score,
        MAX(pa.score)::INTEGER as best_score,
        COUNT(CASE WHEN pa.score >= 80 THEN 1 END)::INTEGER as high_scores
      FROM students s
      JOIN practice_attempts pa ON s.id = pa.student_id
      WHERE ${sql.raw(whereClause.replace(/\$\d+/g, (match) => {
        const index = parseInt(match.substring(1)) - 1
        return `$${index + 1}`
      }))}
      AND pa.completed_at IS NOT NULL
      GROUP BY s.id, s.name, s.email
      HAVING COUNT(pa.id) >= 3
      ORDER BY average_score DESC, total_attempts DESC
      LIMIT 10
    `

    // Struggling students (low scores)
    const strugglingStudents = await sql`
      SELECT 
        s.id,
        s.name,
        s.email,
        COUNT(pa.id)::INTEGER as total_attempts,
        COALESCE(AVG(pa.score), 0)::NUMERIC as average_score,
        MIN(pa.score)::INTEGER as worst_score,
        COUNT(CASE WHEN pa.score < 60 THEN 1 END)::INTEGER as low_scores
      FROM students s
      JOIN practice_attempts pa ON s.id = pa.student_id
      WHERE ${sql.raw(whereClause.replace(/\$\d+/g, (match) => {
        const index = parseInt(match.substring(1)) - 1
        return `$${index + 1}`
      }))}
      AND pa.completed_at IS NOT NULL
      GROUP BY s.id, s.name, s.email
      HAVING COUNT(pa.id) >= 2 AND AVG(pa.score) < 70
      ORDER BY average_score ASC, total_attempts DESC
      LIMIT 10
    `

    // Question difficulty analysis
    const questionDifficulty = await sql`
      SELECT 
        pq.difficulty,
        pq.topic,
        COUNT(pqa.question_id)::INTEGER as total_attempts,
        COUNT(CASE WHEN pqa.is_correct THEN 1 END)::INTEGER as correct_attempts,
        ROUND(
          (COUNT(CASE WHEN pqa.is_correct THEN 1 END)::NUMERIC / COUNT(pqa.question_id)) * 100, 
          2
        ) as success_rate
      FROM practice_questions pq
      JOIN practice_answers pqa ON pq.question_id = pqa.question_id
      JOIN practice_attempts pa ON pqa.attempt_id = pa.id
      WHERE ${sql.raw(whereClause.replace(/\$\d+/g, (match) => {
        const index = parseInt(match.substring(1)) - 1
        return `$${index + 1}`
      }))}
      AND pa.completed_at IS NOT NULL
      GROUP BY pq.difficulty, pq.topic
      ORDER BY success_rate ASC
      LIMIT 20
    `

    return NextResponse.json({
      overall: overallStats[0] || {
        total_attempts: 0,
        unique_students: 0,
        average_score: 0,
        average_correct: 0,
        average_questions: 0
      },
      topics: topicStats,
      difficulties: difficultyStats,
      dailyTrends,
      topStudents,
      strugglingStudents,
      questionDifficulty,
      filters: {
        timeRange,
        topic,
        difficulty,
        startDate: startDate.toISOString(),
        endDate: now.toISOString()
      }
    })
  } catch (error) {
    console.error("[Practice Analytics] Failed to fetch analytics:", error)
    return NextResponse.json({ error: "Failed to fetch practice analytics" }, { status: 500 })
  }
}
