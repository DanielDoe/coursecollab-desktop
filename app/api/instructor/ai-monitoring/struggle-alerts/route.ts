import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const hours = parseInt(searchParams.get("hours") || "6")
    const threshold = parseInt(searchParams.get("threshold") || "3") // Repeated questions threshold

    // Find students asking repeatedly about the same topic
    const struggles = await sql`
      SELECT 
        aitc.student_id,
        s.full_name as student_name,
        s.student_id as student_number,
        s.section,
        aitc.topic,
        COUNT(*) as question_count,
        ARRAY_AGG(aitc.message ORDER BY aitc.created_at DESC) as messages,
        MIN(aitc.created_at) as first_asked,
        MAX(aitc.created_at) as last_asked,
        EXTRACT(EPOCH FROM (MAX(aitc.created_at) - MIN(aitc.created_at)))/60 as time_span_minutes
      FROM ai_tutor_conversations aitc
      JOIN students s ON aitc.student_id = s.id
      WHERE 
        aitc.created_at >= NOW() - INTERVAL '${hours} hours'
        AND aitc.topic IS NOT NULL
        AND aitc.topic != ''
      GROUP BY aitc.student_id, s.full_name, s.student_id, s.section, aitc.topic
      HAVING COUNT(*) >= ${threshold}
      ORDER BY question_count DESC, last_asked DESC
    `

    // Calculate severity (high = many questions in short time)
    const alertsWithSeverity = struggles.map((struggle: any) => {
      const questionsPerHour = struggle.question_count / Math.max(struggle.time_span_minutes / 60, 0.5)
      let severity = "low"
      if (questionsPerHour >= 4) severity = "critical"
      else if (questionsPerHour >= 2) severity = "high"
      else if (questionsPerHour >= 1) severity = "medium"

      return {
        ...struggle,
        severity,
        questionsPerHour: Math.round(questionsPerHour * 10) / 10
      }
    })

    // Get struggling students count by topic
    const topicSummary = await sql`
      SELECT 
        topic,
        COUNT(DISTINCT student_id) as struggling_students,
        COUNT(*) as total_questions
      FROM ai_tutor_conversations
      WHERE 
        created_at >= NOW() - INTERVAL '${hours} hours'
        AND topic IS NOT NULL
        AND topic != ''
      GROUP BY topic
      HAVING COUNT(DISTINCT student_id) >= 2
      ORDER BY struggling_students DESC
      LIMIT 5
    `

    return NextResponse.json({
      success: true,
      struggles: alertsWithSeverity,
      topicSummary,
      criticalCount: alertsWithSeverity.filter((s: any) => s.severity === "critical").length,
      highCount: alertsWithSeverity.filter((s: any) => s.severity === "high").length,
      timeRange: `Last ${hours} hours`
    })
  } catch (error) {
    console.error("[Instructor AI Monitoring - Struggle Alerts Error]", error)
    return NextResponse.json(
      { 
        success: false, 
        error: "Failed to fetch struggle alerts",
        struggles: [],
        topicSummary: [],
        criticalCount: 0,
        highCount: 0
      },
      { status: 500 }
    )
  }
}

