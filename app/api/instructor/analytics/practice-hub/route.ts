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
    const period = searchParams.get("period") || "30d"

    // Calculate date range
    const now = new Date()
    let startDate: Date
    switch (period) {
      case "7d":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case "30d":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      case "90d":
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
        break
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    }

    // Overall Practice Hub Statistics
    const overallStats = await sql`
      SELECT 
        COUNT(*) as total_attempts,
        COUNT(DISTINCT student_id) as unique_students,
        COUNT(CASE WHEN completed_at IS NOT NULL THEN 1 END) as completed_attempts,
        AVG(score_percentage) as avg_score,
        SUM(CASE WHEN score_percentage >= 70 THEN 1 ELSE 0 END) as passed_attempts,
        AVG(time_spent_minutes) as avg_time_spent,
        COUNT(DISTINCT topics) as unique_topics_attempted
      FROM practice_attempts
      WHERE attempted_at >= ${startDate.toISOString()}
    `

    // Performance by topic
    const performanceByTopic = await sql`
      SELECT 
        topics as topic,
        COUNT(*) as attempts,
        COUNT(DISTINCT student_id) as unique_students,
        COUNT(CASE WHEN completed_at IS NOT NULL THEN 1 END) as completed,
        AVG(score_percentage) as avg_score,
        SUM(CASE WHEN score_percentage >= 70 THEN 1 ELSE 0 END) as passed,
        ROUND(
          SUM(CASE WHEN score_percentage >= 70 THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 
          2
        ) as pass_rate,
        AVG(time_spent_minutes) as avg_time_spent
      FROM practice_attempts
      WHERE attempted_at >= ${startDate.toISOString()}
      GROUP BY topics
      ORDER BY attempts DESC
    `

    // Performance by session
    const performanceBySession = await sql`
      SELECT 
        COALESCE(sess.code, s.section) as session_code,
        COUNT(pa.id) as attempts,
        COUNT(DISTINCT pa.student_id) as unique_students,
        AVG(pa.score_percentage) as avg_score,
        SUM(CASE WHEN pa.score_percentage >= 70 THEN 1 ELSE 0 END) as passed_attempts,
        ROUND(
          SUM(CASE WHEN pa.score_percentage >= 70 THEN 1 ELSE 0 END) * 100.0 / COUNT(pa.id), 
          2
        ) as pass_rate,
        AVG(pa.time_spent_minutes) as avg_time_spent
      FROM practice_attempts pa
      JOIN students s ON pa.student_id = s.id
      LEFT JOIN sessions sess ON s.session_id = sess.id
      WHERE pa.attempted_at >= ${startDate.toISOString()}
      GROUP BY COALESCE(sess.code, s.section)
      ORDER BY attempts DESC
    `

    // Top performing students
    const topStudents = await sql`
      SELECT 
        s.id,
        s.full_name,
        COALESCE(sess.code, s.section) as session_code,
        COUNT(pa.id) as attempts,
        AVG(pa.score_percentage) as avg_score,
        SUM(CASE WHEN pa.score_percentage >= 70 THEN 1 ELSE 0 END) as passed_attempts,
        ROUND(
          SUM(CASE WHEN pa.score_percentage >= 70 THEN 1 ELSE 0 END) * 100.0 / COUNT(pa.id), 
          2
        ) as pass_rate,
        AVG(pa.time_spent_minutes) as avg_time_spent,
        MAX(pa.attempted_at) as last_attempt
      FROM practice_attempts pa
      JOIN students s ON pa.student_id = s.id
      LEFT JOIN sessions sess ON s.session_id = sess.id
      WHERE pa.attempted_at >= ${startDate.toISOString()}
      GROUP BY s.id, s.full_name, COALESCE(sess.code, s.section)
      HAVING COUNT(pa.id) > 0
      ORDER BY avg_score DESC, attempts DESC
      LIMIT 20
    `

    // Students needing support
    const strugglingStudents = await sql`
      SELECT 
        s.id,
        s.full_name,
        COALESCE(sess.code, s.section) as session_code,
        COUNT(pa.id) as attempts,
        AVG(pa.score_percentage) as avg_score,
        MIN(pa.score_percentage) as lowest_score,
        SUM(CASE WHEN pa.score_percentage >= 70 THEN 1 ELSE 0 END) as passed_attempts,
        ROUND(
          SUM(CASE WHEN pa.score_percentage >= 70 THEN 1 ELSE 0 END) * 100.0 / COUNT(pa.id), 
          2
        ) as pass_rate,
        MAX(pa.attempted_at) as last_attempt
      FROM practice_attempts pa
      JOIN students s ON pa.student_id = s.id
      LEFT JOIN sessions sess ON s.session_id = sess.id
      WHERE pa.attempted_at >= ${startDate.toISOString()}
      GROUP BY s.id, s.full_name, COALESCE(sess.code, s.section)
      HAVING COUNT(pa.id) > 0 AND AVG(pa.score_percentage) < 60
      ORDER BY avg_score ASC, attempts DESC
      LIMIT 20
    `

    // Time-based trends
    const timeTrends = await sql`
      SELECT 
        DATE(attempted_at) as date,
        COUNT(*) as attempts,
        COUNT(DISTINCT student_id) as unique_students,
        AVG(score_percentage) as avg_score,
        SUM(CASE WHEN score_percentage >= 70 THEN 1 ELSE 0 END) as passed_attempts,
        ROUND(
          SUM(CASE WHEN score_percentage >= 70 THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 
          2
        ) as pass_rate
      FROM practice_attempts
      WHERE attempted_at >= ${startDate.toISOString()}
      GROUP BY DATE(attempted_at)
      ORDER BY date DESC
      LIMIT 30
    `

    // Score distribution
    const scoreDistribution = await sql`
      SELECT 
        CASE 
          WHEN score_percentage >= 90 THEN '90-100'
          WHEN score_percentage >= 80 THEN '80-89'
          WHEN score_percentage >= 70 THEN '70-79'
          WHEN score_percentage >= 60 THEN '60-69'
          WHEN score_percentage >= 50 THEN '50-59'
          ELSE 'Below 50'
        END as score_range,
        COUNT(*) as count,
        ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM practice_attempts WHERE attempted_at >= ${startDate.toISOString()}), 2) as percentage
      FROM practice_attempts
      WHERE attempted_at >= ${startDate.toISOString()}
      GROUP BY 
        CASE 
          WHEN score_percentage >= 90 THEN '90-100'
          WHEN score_percentage >= 80 THEN '80-89'
          WHEN score_percentage >= 70 THEN '70-79'
          WHEN score_percentage >= 60 THEN '60-69'
          WHEN score_percentage >= 50 THEN '50-59'
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

    // Practice leaderboard data
    const leaderboardData = await sql`
      SELECT 
        s.id,
        s.full_name,
        COALESCE(sess.code, s.section) as session_code,
        pl.total_practice_points as points,
        pl.total_practice_attempts as total_attempts,
        pl.avg_practice_score as avg_score,
        pl.total_questions_practiced,
        pl.last_practice_date as last_activity
      FROM practice_leaderboard pl
      JOIN students s ON pl.student_id = s.id
      LEFT JOIN sessions sess ON s.session_id = sess.id
      ORDER BY pl.total_practice_points DESC NULLS LAST
      LIMIT 50
    `

    // Topic difficulty analysis
    const topicDifficultyAnalysis = await sql`
      SELECT 
        topics as topic,
        COUNT(*) as attempts,
        AVG(score_percentage) as avg_score,
        STDDEV(score_percentage) as score_std_dev,
        MIN(score_percentage) as min_score,
        MAX(score_percentage) as max_score,
        AVG(time_spent_minutes) as avg_time_spent,
        ROUND(
          SUM(CASE WHEN score_percentage >= 70 THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 
          2
        ) as pass_rate
      FROM practice_attempts
      WHERE attempted_at >= ${startDate.toISOString()}
      GROUP BY topics
      HAVING COUNT(*) > 5
      ORDER BY avg_score ASC
    `

    // Recent activity
    const recentActivity = await sql`
      SELECT 
        pa.id,
        s.full_name,
        COALESCE(sess.code, s.section) as session_code,
        pa.topics,
        pa.score_percentage,
        pa.time_spent_minutes,
        pa.attempted_at,
        pa.completed_at
      FROM practice_attempts pa
      JOIN students s ON pa.student_id = s.id
      LEFT JOIN sessions sess ON s.session_id = sess.id
      WHERE pa.attempted_at >= ${startDate.toISOString()}
      ORDER BY pa.attempted_at DESC
      LIMIT 50
    `

    return NextResponse.json({
      success: true,
      period,
      dateRange: {
        start: startDate.toISOString(),
        end: now.toISOString()
      },
      overallStats: overallStats[0],
      performanceByTopic,
      performanceBySession,
      topStudents,
      strugglingStudents,
      timeTrends,
      scoreDistribution,
      leaderboardData,
      topicDifficultyAnalysis,
      recentActivity
    })

  } catch (error) {
    console.error("[Practice Hub Analytics] Error:", error)
    return NextResponse.json(
      { error: "Failed to fetch Practice Hub analytics" },
      { status: 500 }
    )
  }
}
