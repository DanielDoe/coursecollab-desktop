import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function GET(req: NextRequest) {
  try {
    // Get analytics data for instructor dashboard
    const [
      totalStudentsResult,
      totalQuizzesResult,
      totalAttemptsResult,
      averageScoreResult,
      recentActivityResult
    ] = await Promise.all([
      // Total students
      sql`SELECT COUNT(*) as count FROM students`,
      
      // Total quizzes
      sql`SELECT COUNT(*) as count FROM quizzes WHERE deleted_at IS NULL`,
      
      // Total attempts
      sql`SELECT COUNT(*) as count FROM quiz_attempts`,
      
      // Average score
      sql`SELECT AVG(score) as avg_score FROM quiz_attempts WHERE score IS NOT NULL`,
      
      // Recent activity (last 10 quiz attempts)
      sql`
        SELECT qa.*, s.name as student_name, q.title as quiz_title
        FROM quiz_attempts qa
        JOIN students s ON qa.student_id = s.id
        JOIN quizzes q ON qa.quiz_id = q.id
        ORDER BY qa.completed_at DESC
        LIMIT 10
      `
    ])

    const totalStudents = totalStudentsResult[0]?.count || 0
    const totalQuizzes = totalQuizzesResult[0]?.count || 0
    const totalAttempts = totalAttemptsResult[0]?.count || 0
    const averageScore = Math.round(averageScoreResult[0]?.avg_score || 0)
    const recentActivity = recentActivityResult

    // Performance by topic
    const topicPerformanceResult = await sql`
      SELECT q.topic, COUNT(*) as total, AVG(qa.score) as average_score
      FROM quiz_attempts qa
      JOIN quizzes q ON qa.quiz_id = q.id
      WHERE q.topic IS NOT NULL
      GROUP BY q.topic
    `
    
    const topicPerformance: Record<string, { total: number; correct: number; average: number }> = {}
    topicPerformanceResult.forEach(row => {
      topicPerformance[row.topic] = {
        total: Number(row.total),
        correct: 0, // This would need more complex logic to calculate correctly
        average: Math.round(Number(row.average_score) || 0)
      }
    })

    // Monthly performance trend
    const monthlyTrendResult = await sql`
      SELECT 
        DATE_TRUNC('month', completed_at) as month,
        COUNT(*) as attempts,
        AVG(score) as average_score
      FROM quiz_attempts
      WHERE completed_at IS NOT NULL
      GROUP BY DATE_TRUNC('month', completed_at)
      ORDER BY month DESC
    `
    
    const monthlyTrend: Record<string, { attempts: number; averageScore: number }> = {}
    monthlyTrendResult.forEach(row => {
      const month = row.month.toISOString().slice(0, 7) // YYYY-MM
      monthlyTrend[month] = {
        attempts: Number(row.attempts),
        averageScore: Math.round(Number(row.average_score) || 0)
      }
    })

    return NextResponse.json({
      overview: {
        totalStudents,
        totalQuizzes,
        totalAttempts,
        averageScore
      },
      topicPerformance,
      monthlyTrend,
      recentActivity: recentActivity.map(activity => ({
        id: activity.id,
        studentName: activity.student_name || 'Unknown',
        quizTitle: activity.quiz_title || 'Unknown',
        score: activity.score,
        completedAt: activity.completed_at
      }))
    })
  } catch (error) {
    console.error("Error fetching analytics:", error)
    return NextResponse.json(
      { error: "Failed to fetch analytics data" },
      { status: 500 }
    )
  }
}

