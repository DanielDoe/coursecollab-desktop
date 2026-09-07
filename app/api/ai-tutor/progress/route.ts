import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

export async function GET(request: NextRequest) {
  try {
    const studentId = request.nextUrl.searchParams.get("studentId")
    if (!studentId) {
      return NextResponse.json({ error: "Student ID required" }, { status: 400 })
    }

    // Fetch topic mastery data
    const topicMastery = await sql`
      SELECT 
        topic,
        mastery_percentage,
        questions_asked,
        accuracy_percentage,
        last_practiced
      FROM ai_tutor_topic_mastery 
      WHERE student_id = ${studentId}
      ORDER BY last_practiced DESC
    `

    // Calculate weakness scores based on questions asked vs mastery
    const topics = topicMastery.map((topic: any) => {
      // More questions + low mastery = higher weakness score
      const weaknessScore = topic.questions_asked > 5 && topic.mastery_percentage < 60
        ? 100 - topic.mastery_percentage
        : 0
      
      // Determine trend (this would be calculated from historical data in production)
      let trend = 'stable'
      if (topic.mastery_percentage >= 80) trend = 'improving'
      if (topic.mastery_percentage < 40 && topic.questions_asked > 10) trend = 'declining'

      return {
        topic: topic.topic,
        mastery: topic.mastery_percentage || 0,
        questionsAsked: topic.questions_asked || 0,
        lastPracticed: topic.last_practiced,
        weaknessScore,
        trend
      }
    })

    // Calculate learning streak
    const streak = await sql`
      SELECT COUNT(DISTINCT DATE(created_at)) as streak_days
      FROM ai_tutor_conversations 
      WHERE student_id = ${studentId}
      AND created_at >= CURRENT_DATE - INTERVAL '7 days'
    `

    // Calculate overall mastery
    const overallMastery = topics.length > 0
      ? Math.round(topics.reduce((sum: number, t: any) => sum + t.mastery, 0) / topics.length)
      : 0

    return NextResponse.json({
      topics,
      streak: streak[0]?.streak_days || 0,
      overallMastery,
      totalTopics: topics.length,
      masteredTopics: topics.filter((t: any) => t.mastery >= 80).length
    })
  } catch (error) {
    console.error("[AI Tutor Progress] Error:", error)
    return NextResponse.json({ 
      error: "Failed to fetch progress",
      topics: [],
      streak: 0,
      overallMastery: 0
    }, { status: 500 })
  }
}

