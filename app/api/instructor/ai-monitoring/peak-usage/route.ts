import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const days = parseInt(searchParams.get("days") || "7")

    // Get usage by hour of day
    const hourlyUsage = await sql`
      SELECT 
        EXTRACT(HOUR FROM created_at) as hour,
        COUNT(*) as question_count,
        COUNT(DISTINCT student_id) as student_count,
        AVG(response_time) as avg_response_time
      FROM ai_tutor_conversations
      WHERE created_at >= NOW() - make_interval(days => ${days})
      GROUP BY EXTRACT(HOUR FROM created_at)
      ORDER BY hour
    `

    // Get usage by day of week
    const dailyUsage = await sql`
      SELECT 
        EXTRACT(DOW FROM created_at) as day_of_week,
        COUNT(*) as question_count,
        COUNT(DISTINCT student_id) as student_count,
        AVG(response_time) as avg_response_time
      FROM ai_tutor_conversations
      WHERE created_at >= NOW() - make_interval(days => ${days})
      GROUP BY EXTRACT(DOW FROM created_at)
      ORDER BY day_of_week
    `

    // Get usage by date
    const dateUsage = await sql`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as question_count,
        COUNT(DISTINCT student_id) as student_count,
        COUNT(DISTINCT topic) as topics_discussed,
        AVG(response_time) as avg_response_time
      FROM ai_tutor_conversations
      WHERE created_at >= NOW() - make_interval(days => ${days})
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `

    // Map day numbers to names
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const dailyUsageFormatted = dailyUsage.map((d: any) => ({
      ...d,
      day_name: dayNames[parseInt(d.day_of_week)]
    }))

    // Find peak times
    const peakHour = hourlyUsage.reduce((max: any, current: any) => 
      current.question_count > (max?.question_count || 0) ? current : max, 
      null
    )

    const peakDay = dailyUsageFormatted.reduce((max: any, current: any) => 
      current.question_count > (max?.question_count || 0) ? current : max,
      null
    )

    // Calculate peak patterns
    const morningHours = [6, 7, 8, 9, 10, 11]
    const afternoonHours = [12, 13, 14, 15, 16, 17]
    const eveningHours = [18, 19, 20, 21, 22, 23]
    const nightHours = [0, 1, 2, 3, 4, 5]

    const timePatterns = {
      morning: hourlyUsage
        .filter((h: any) => morningHours.includes(parseInt(h.hour)))
        .reduce((sum: number, h: any) => sum + parseInt(h.question_count), 0),
      afternoon: hourlyUsage
        .filter((h: any) => afternoonHours.includes(parseInt(h.hour)))
        .reduce((sum: number, h: any) => sum + parseInt(h.question_count), 0),
      evening: hourlyUsage
        .filter((h: any) => eveningHours.includes(parseInt(h.hour)))
        .reduce((sum: number, h: any) => sum + parseInt(h.question_count), 0),
      night: hourlyUsage
        .filter((h: any) => nightHours.includes(parseInt(h.hour)))
        .reduce((sum: number, h: any) => sum + parseInt(h.question_count), 0)
    }

    return NextResponse.json({
      success: true,
      hourlyUsage,
      dailyUsage: dailyUsageFormatted,
      dateUsage,
      peakHour: peakHour ? {
        hour: parseInt(peakHour.hour),
        hourFormatted: `${peakHour.hour}:00`,
        questionCount: parseInt(peakHour.question_count),
        studentCount: parseInt(peakHour.student_count)
      } : null,
      peakDay: peakDay ? {
        day: peakDay.day_name,
        questionCount: parseInt(peakDay.question_count),
        studentCount: parseInt(peakDay.student_count)
      } : null,
      timePatterns,
      timeRange: `Last ${days} days`
    })
  } catch (error) {
    console.error("[Instructor AI Monitoring - Peak Usage Error]", error)
    return NextResponse.json(
      { 
        success: false, 
        error: "Failed to fetch peak usage data",
        hourlyUsage: [],
        dailyUsage: [],
        dateUsage: [],
        peakHour: null,
        peakDay: null,
        timePatterns: { morning: 0, afternoon: 0, evening: 0, night: 0 }
      },
      { status: 500 }
    )
  }
}

