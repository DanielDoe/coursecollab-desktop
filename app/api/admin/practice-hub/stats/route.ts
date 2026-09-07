import { type NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { sql } from "@/lib/db"

export async function GET(request: NextRequest) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    // Fetch practice hub statistics
    const [
      totalTopics,
      activeTopics,
      totalQuestions,
      totalStudents,
      dailyAttempts,
      weeklyAttempts,
      averageCompletionRate,
      topPerformers,
      topicPerformance
    ] = await Promise.all([
      // Total topics
      sql`SELECT COUNT(*) as total FROM practice_configs`,
      
      // Active topics
      sql`SELECT COUNT(*) as active FROM practice_configs WHERE is_active = true`,
      
      // Total questions
      sql`SELECT COUNT(*) as total FROM questions WHERE is_archived = false`,
      
      // Total students
      sql`SELECT COUNT(DISTINCT student_id) as total FROM practice_attempts WHERE created_at > NOW() - INTERVAL '30 days'`,
      
      // Daily attempts
      sql`SELECT COUNT(*) as daily FROM practice_attempts WHERE created_at > NOW() - INTERVAL '1 day'`,
      
      // Weekly attempts
      sql`SELECT COUNT(*) as weekly FROM practice_attempts WHERE created_at > NOW() - INTERVAL '7 days'`,
      
      // Average completion rate
      sql`
        SELECT AVG(CASE WHEN completed_at IS NOT NULL THEN 100.0 ELSE 0 END) as avg_completion
        FROM practice_attempts
        WHERE created_at > NOW() - INTERVAL '30 days'
      `,
      
      // Top performers
      sql`
        SELECT 
          s.full_name as student_name,
          AVG(pa.score) as score,
          COUNT(pa.id) as attempts
        FROM practice_attempts pa
        JOIN students s ON pa.student_id = s.id
        WHERE pa.created_at > NOW() - INTERVAL '30 days'
        GROUP BY s.id, s.full_name
        ORDER BY score DESC, attempts DESC
        LIMIT 5
      `,
      
      // Topic performance
      sql`
        SELECT 
          pc.topic,
          COUNT(CASE WHEN pa.completed_at IS NOT NULL THEN 1 END) * 100.0 / COUNT(pa.id) as completion_rate,
          AVG(pa.score) as average_score,
          COUNT(pa.id) as attempts
        FROM practice_configs pc
        LEFT JOIN practice_attempts pa ON pc.id = pa.config_id
        WHERE pa.created_at > NOW() - INTERVAL '30 days'
        GROUP BY pc.id, pc.topic
        ORDER BY completion_rate DESC
      `
    ])

    // Format statistics
    const stats = {
      total_topics: Number(totalTopics[0]?.total || 0),
      active_topics: Number(activeTopics[0]?.active || 0),
      total_questions: Number(totalQuestions[0]?.total || 0),
      total_students: Number(totalStudents[0]?.total || 0),
      daily_attempts: Number(dailyAttempts[0]?.daily || 0),
      weekly_attempts: Number(weeklyAttempts[0]?.weekly || 0),
      average_completion_rate: Number(averageCompletionRate[0]?.avg_completion || 0),
      top_performers: topPerformers.map((p: any) => ({
        student_name: p.student_name,
        score: Number(p.score || 0),
        attempts: Number(p.attempts || 0),
      })),
      topic_performance: topicPerformance.map((t: any) => ({
        topic: t.topic,
        completion_rate: Number(t.completion_rate || 0),
        average_score: Number(t.average_score || 0),
        attempts: Number(t.attempts || 0),
      })),
    }

    return NextResponse.json({ stats })
  } catch (error) {
    console.error("Failed to fetch practice hub stats:", error)
    return NextResponse.json({ error: "Failed to fetch practice hub stats" }, { status: 500 })
  }
}

