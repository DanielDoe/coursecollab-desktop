import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get("limit") || "50")
    const minutes = parseInt(searchParams.get("minutes") || "60") // Last N minutes

    // Get recent AI interactions with student info
    const recentActivity = await sql`
      SELECT 
        aitc.id,
        aitc.student_id,
        aitc.message,
        aitc.response,
        aitc.topic,
        aitc.created_at,
        aitc.response_time,
        s.full_name as student_name,
        s.student_id as student_number,
        s.section
      FROM ai_tutor_conversations aitc
      JOIN students s ON aitc.student_id = s.id
      WHERE aitc.created_at >= NOW() - INTERVAL '${minutes} minutes'
      ORDER BY aitc.created_at DESC
      LIMIT ${limit}
    `

    // Get live statistics
    const stats = await sql`
      SELECT 
        COUNT(DISTINCT student_id) as active_students,
        COUNT(*) as total_questions,
        AVG(response_time) as avg_response_time,
        COUNT(DISTINCT topic) as topics_discussed
      FROM ai_tutor_conversations
      WHERE created_at >= NOW() - INTERVAL '${minutes} minutes'
    `

    return NextResponse.json({
      success: true,
      activity: recentActivity,
      stats: stats[0] || {
        active_students: 0,
        total_questions: 0,
        avg_response_time: 0,
        topics_discussed: 0
      },
      timeRange: `Last ${minutes} minutes`
    })
  } catch (error) {
    console.error("[Instructor AI Monitoring - Activity Error]", error)
    return NextResponse.json(
      { 
        success: false, 
        error: "Failed to fetch activity data",
        activity: [],
        stats: {
          active_students: 0,
          total_questions: 0,
          avg_response_time: 0,
          topics_discussed: 0
        }
      },
      { status: 500 }
    )
  }
}

