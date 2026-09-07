import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

export async function GET(request: NextRequest) {
  try {
    const studentId = request.nextUrl.searchParams.get("studentId")
    if (!studentId) {
      return NextResponse.json({ error: "Student ID required" }, { status: 400 })
    }

    // Convert studentId to number if needed
    const studentIdNum = parseInt(studentId)

    // Initialize default stats
    let stats: any[] = []
    let sessions: any[] = []
    let topicMastery: any[] = []
    let streak: any[] = []

    // Fetch AI tutor stats with error handling
    try {
      stats = await sql`
        SELECT 
          COUNT(*) as total_questions,
          COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as weekly_questions,
          AVG(response_time) as avg_response_time,
          AVG(satisfaction_score) as avg_satisfaction
        FROM ai_tutor_conversations 
        WHERE student_id = ${studentIdNum}
      `
    } catch (error: any) {
      if (error.message?.includes('does not exist')) {
      } else {
        console.error("[AI Tutor Stats] Error fetching conversations:", error)
      }
      stats = [{ total_questions: 0, weekly_questions: 0, avg_response_time: 0, avg_satisfaction: 0 }]
    }

    // Fetch recent sessions with error handling
    try {
      sessions = await sql`
        SELECT 
          id,
          topic,
          duration_minutes,
          questions_answered,
          accuracy_percentage,
          created_at
        FROM ai_tutor_sessions 
        WHERE student_id = ${studentIdNum}
        ORDER BY created_at DESC
        LIMIT 5
      `
    } catch (error: any) {
      if (error.message?.includes('does not exist')) {
      } else {
        console.error("[AI Tutor Stats] Error fetching sessions:", error)
      }
      sessions = []
    }

    // Fetch topic mastery with error handling
    try {
      topicMastery = await sql`
        SELECT 
          topic,
          mastery_percentage,
          questions_asked,
          accuracy_percentage
        FROM ai_tutor_topic_mastery 
        WHERE student_id = ${studentIdNum}
        ORDER BY mastery_percentage DESC
      `
    } catch (error: any) {
      if (error.message?.includes('does not exist')) {
      } else {
        console.error("[AI Tutor Stats] Error fetching topic mastery:", error)
      }
      topicMastery = []
    }

    // Fetch learning streak with error handling
    try {
      streak = await sql`
        SELECT 
          COUNT(*) as streak_days
        FROM (
          SELECT DISTINCT DATE(created_at) as study_date
          FROM ai_tutor_conversations 
          WHERE student_id = ${studentIdNum}
          AND created_at >= CURRENT_DATE - INTERVAL '30 days'
          ORDER BY study_date DESC
        ) daily_study
      `
    } catch (error: any) {
      if (error.message?.includes('does not exist')) {
      } else {
        console.error("[AI Tutor Stats] Error fetching streak:", error)
      }
      streak = [{ streak_days: 0 }]
    }

    const aiStats = {
      totalQuestions: parseInt(stats[0]?.total_questions) || 0,
      weeklyProgress: Math.min(100, (parseInt(stats[0]?.weekly_questions) || 0) * 10),
      streakDays: parseInt(streak[0]?.streak_days) || 0,
      topicsMastered: topicMastery.filter(t => parseFloat(t.mastery_percentage) >= 80).length,
      averageResponseTime: parseFloat(stats[0]?.avg_response_time) || 0,
      satisfactionScore: Math.round(parseFloat(stats[0]?.avg_satisfaction) || 0)
    }

    return NextResponse.json({ 
      stats: aiStats,
      sessions: sessions.map(session => ({
        id: session.id,
        topic: session.topic || 'General',
        duration: parseInt(session.duration_minutes) || 0,
        questionsAnswered: parseInt(session.questions_answered) || 0,
        accuracy: parseFloat(session.accuracy_percentage) || 0,
        timestamp: session.created_at
      })),
      topicMastery: topicMastery.map(topic => ({
        topic: topic.topic || 'General',
        mastery: parseFloat(topic.mastery_percentage) || 0,
        questionsAsked: parseInt(topic.questions_asked) || 0,
        accuracy: parseFloat(topic.accuracy_percentage) || 0
      }))
    })
  } catch (error: any) {
    console.error("[v0] Failed to fetch AI stats:", error)
    // Return default stats instead of error
    return NextResponse.json({ 
      stats: {
        totalQuestions: 0,
        weeklyProgress: 0,
        streakDays: 0,
        topicsMastered: 0,
        averageResponseTime: 0,
        satisfactionScore: 0
      },
      sessions: [],
      topicMastery: []
    })
  }
}

