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

    // Overall AI Tutor Statistics
    const overallStats = await sql`
      SELECT 
        COUNT(*) as total_conversations,
        COUNT(DISTINCT student_id) as unique_students,
        COUNT(DISTINCT DATE(created_at)) as active_days,
        AVG(CASE WHEN rating IS NOT NULL THEN rating ELSE 0 END) as avg_rating,
        COUNT(CASE WHEN rating IS NOT NULL THEN 1 END) as rated_conversations
      FROM ai_tutor_conversations
      WHERE created_at >= ${startDate.toISOString()}
    `

    // Usage by session
    const usageBySession = await sql`
      SELECT 
        s.session_code,
        COUNT(atc.id) as conversations,
        COUNT(DISTINCT atc.student_id) as unique_students,
        AVG(CASE WHEN atc.rating IS NOT NULL THEN atc.rating ELSE 0 END) as avg_rating
      FROM ai_tutor_conversations atc
      JOIN students s ON atc.student_id = s.id
      WHERE atc.created_at >= ${startDate.toISOString()}
      GROUP BY s.session_code
      ORDER BY conversations DESC
    `

    // Most active students
    const mostActiveStudents = await sql`
      SELECT 
        s.id,
        s.first_name,
        s.last_name,
        s.session_code,
        COUNT(atc.id) as conversations,
        AVG(CASE WHEN atc.rating IS NOT NULL THEN atc.rating ELSE 0 END) as avg_rating,
        MAX(atc.created_at) as last_interaction
      FROM ai_tutor_conversations atc
      JOIN students s ON atc.student_id = s.id
      WHERE atc.created_at >= ${startDate.toISOString()}
      GROUP BY s.id, s.first_name, s.last_name, s.session_code
      ORDER BY conversations DESC
      LIMIT 20
    `

    // Topic mastery analytics
    const topicMastery = await sql`
      SELECT 
        topic,
        COUNT(DISTINCT student_id) as students_count,
        AVG(mastery_percentage) as avg_mastery,
        AVG(questions_asked) as avg_questions,
        AVG(accuracy_percentage) as avg_accuracy
      FROM ai_tutor_topic_mastery
      WHERE updated_at >= ${startDate.toISOString()}
      GROUP BY topic
      ORDER BY avg_mastery DESC
    `

    // Conversation topics analysis
    const conversationTopics = await sql`
      SELECT 
        topic,
        COUNT(*) as conversation_count,
        COUNT(DISTINCT student_id) as unique_students,
        AVG(CASE WHEN rating IS NOT NULL THEN rating ELSE 0 END) as avg_rating
      FROM ai_tutor_conversations
      WHERE created_at >= ${startDate.toISOString()}
        AND topic IS NOT NULL
      GROUP BY topic
      ORDER BY conversation_count DESC
      LIMIT 20
    `

    // Time-based usage trends
    const usageTrends = await sql`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as conversations,
        COUNT(DISTINCT student_id) as unique_students,
        AVG(CASE WHEN rating IS NOT NULL THEN rating ELSE 0 END) as avg_rating
      FROM ai_tutor_conversations
      WHERE created_at >= ${startDate.toISOString()}
      GROUP BY DATE(created_at)
      ORDER BY date DESC
      LIMIT 30
    `

    // Student struggle analysis
    const studentStruggles = await sql`
      SELECT 
        s.id,
        s.first_name,
        s.last_name,
        s.session_code,
        COUNT(ats.id) as struggle_count,
        AVG(ats.severity) as avg_severity,
        MAX(ats.created_at) as last_struggle
      FROM ai_tutor_struggles ats
      JOIN students s ON ats.student_id = s.id
      WHERE ats.created_at >= ${startDate.toISOString()}
      GROUP BY s.id, s.first_name, s.last_name, s.session_code
      ORDER BY struggle_count DESC, avg_severity DESC
      LIMIT 20
    `

    // AI response quality metrics
    const responseQuality = await sql`
      SELECT 
        CASE 
          WHEN rating >= 4 THEN 'Excellent'
          WHEN rating >= 3 THEN 'Good'
          WHEN rating >= 2 THEN 'Fair'
          WHEN rating >= 1 THEN 'Poor'
          ELSE 'Unrated'
        END as quality_category,
        COUNT(*) as count,
        AVG(rating) as avg_rating
      FROM ai_tutor_conversations
      WHERE created_at >= ${startDate.toISOString()}
        AND rating IS NOT NULL
      GROUP BY 
        CASE 
          WHEN rating >= 4 THEN 'Excellent'
          WHEN rating >= 3 THEN 'Good'
          WHEN rating >= 2 THEN 'Fair'
          WHEN rating >= 1 THEN 'Poor'
          ELSE 'Unrated'
        END
      ORDER BY avg_rating DESC
    `

    // Peak usage hours
    const peakUsageHours = await sql`
      SELECT 
        EXTRACT(HOUR FROM created_at) as hour,
        COUNT(*) as conversations,
        COUNT(DISTINCT student_id) as unique_students
      FROM ai_tutor_conversations
      WHERE created_at >= ${startDate.toISOString()}
      GROUP BY EXTRACT(HOUR FROM created_at)
      ORDER BY conversations DESC
    `

    // AI Tutor effectiveness by assessment type
    const effectivenessByAssessment = await sql`
      SELECT 
        q.assessment_type,
        COUNT(DISTINCT atc.student_id) as students_using_ai,
        COUNT(atc.id) as ai_conversations,
        AVG(qa.score) as avg_quiz_score,
        AVG(CASE WHEN atc.rating IS NOT NULL THEN atc.rating ELSE 0 END) as avg_ai_rating
      FROM ai_tutor_conversations atc
      LEFT JOIN quiz_attempts qa ON atc.student_id = qa.student_id
      LEFT JOIN quizzes q ON qa.quiz_id = q.id AND q.deleted_at IS NULL
      WHERE atc.created_at >= ${startDate.toISOString()}
      GROUP BY q.assessment_type
      ORDER BY students_using_ai DESC
    `

    // Recent conversations
    const recentConversations = await sql`
      SELECT 
        atc.id,
        s.first_name,
        s.last_name,
        s.session_code,
        atc.topic,
        atc.message_count,
        atc.rating,
        atc.created_at,
        atc.updated_at
      FROM ai_tutor_conversations atc
      JOIN students s ON atc.student_id = s.id
      WHERE atc.created_at >= ${startDate.toISOString()}
      ORDER BY atc.created_at DESC
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
      usageBySession,
      mostActiveStudents,
      topicMastery,
      conversationTopics,
      usageTrends,
      studentStruggles,
      responseQuality,
      peakUsageHours,
      effectivenessByAssessment,
      recentConversations
    })

  } catch (error) {
    console.error("[AI Tutor Analytics] Error:", error)
    return NextResponse.json(
      { error: "Failed to fetch AI Tutor analytics" },
      { status: 500 }
    )
  }
}
