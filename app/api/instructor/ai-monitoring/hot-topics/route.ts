import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const hours = parseInt(searchParams.get("hours") || "24")

    // Get hot topics - most frequently asked about in recent period
    const hotTopics = await sql`
      SELECT 
        topic,
        COUNT(*) as question_count,
        COUNT(DISTINCT student_id) as student_count,
        AVG(response_time) as avg_response_time,
        MAX(created_at) as last_asked,
        ARRAY_AGG(DISTINCT s.full_name ORDER BY s.full_name) as students
      FROM ai_tutor_conversations aitc
      JOIN students s ON aitc.student_id = s.id
      WHERE 
        aitc.created_at >= NOW() - INTERVAL '${hours} hours'
        AND topic IS NOT NULL
        AND topic != ''
        AND topic != 'General'
      GROUP BY topic
      HAVING COUNT(*) >= 2
      ORDER BY question_count DESC, last_asked DESC
      LIMIT 10
    `

    // Calculate trend (comparing to previous period)
    const trends = await Promise.all(
      hotTopics.map(async (topic: any) => {
        const currentPeriod = await sql`
          SELECT COUNT(*) as count
          FROM ai_tutor_conversations
          WHERE 
            topic = ${topic.topic}
            AND created_at >= NOW() - INTERVAL '${hours} hours'
        `

        const previousPeriod = await sql`
          SELECT COUNT(*) as count
          FROM ai_tutor_conversations
          WHERE 
            topic = ${topic.topic}
            AND created_at >= NOW() - INTERVAL '${hours * 2} hours'
            AND created_at < NOW() - INTERVAL '${hours} hours'
        `

        const currentCount = parseInt(currentPeriod[0]?.count || 0)
        const previousCount = parseInt(previousPeriod[0]?.count || 0)
        
        let trend = "stable"
        let trendPercentage = 0
        
        if (previousCount > 0) {
          trendPercentage = ((currentCount - previousCount) / previousCount) * 100
          if (trendPercentage > 20) trend = "rising"
          else if (trendPercentage < -20) trend = "falling"
        } else if (currentCount > 0) {
          trend = "new"
          trendPercentage = 100
        }

        return {
          ...topic,
          trend,
          trendPercentage: Math.round(trendPercentage)
        }
      })
    )

    return NextResponse.json({
      success: true,
      hotTopics: trends,
      timeRange: `Last ${hours} hours`
    })
  } catch (error) {
    console.error("[Instructor AI Monitoring - Hot Topics Error]", error)
    return NextResponse.json(
      { 
        success: false, 
        error: "Failed to fetch hot topics",
        hotTopics: []
      },
      { status: 500 }
    )
  }
}

