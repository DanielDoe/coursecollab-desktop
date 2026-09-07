import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { createForFeature } from "@/lib/resolve-feature-ai-model"
import OpenAI from "openai"

export const dynamic = "force-dynamic"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const days = parseInt(searchParams.get("days") || "7")

    // Get hourly question distribution
    const hourlyActivity = await sql`
      SELECT 
        EXTRACT(HOUR FROM created_at) as hour,
        EXTRACT(DOW FROM created_at) as day_of_week,
        COUNT(*) as question_count,
        COUNT(DISTINCT student_id) as student_count,
        ARRAY_AGG(DISTINCT topic) as topics
      FROM ai_tutor_conversations
      WHERE created_at >= NOW() - make_interval(days => ${days})
      GROUP BY EXTRACT(HOUR FROM created_at), EXTRACT(DOW FROM created_at)
      ORDER BY question_count DESC
    `

    // Get student availability patterns
    const studentPatterns = await sql`
      SELECT 
        student_id,
        ARRAY_AGG(DISTINCT EXTRACT(HOUR FROM created_at)) as active_hours,
        ARRAY_AGG(DISTINCT EXTRACT(DOW FROM created_at)) as active_days,
        COUNT(*) as total_questions
      FROM ai_tutor_conversations
      WHERE created_at >= NOW() - make_interval(days => ${days})
      GROUP BY student_id
      HAVING COUNT(*) >= 5
    `

    // Get struggle patterns
    const strugglePatterns = await sql`
      SELECT 
        topic,
        EXTRACT(HOUR FROM created_at) as hour,
        COUNT(DISTINCT student_id) as struggling_students
      FROM ai_tutor_conversations
      WHERE 
        created_at >= NOW() - make_interval(days => ${days})
        AND topic IS NOT NULL
      GROUP BY topic, EXTRACT(HOUR FROM created_at)
      HAVING COUNT(DISTINCT student_id) >= 5
      ORDER BY struggling_students DESC
    `

    const systemPrompt = `You are an expert at optimizing instructor schedules for maximum student support.

Your task: Recommend optimal office hours based on student activity patterns.

Consider:
1. When students are most active asking questions
2. When most students are struggling
3. Coverage across different days/times
4. Balance instructor workload
5. Virtual vs in-person recommendations

Provide recommendations in this JSON format:
{
  "recommendations": [
    {
      "day": "Monday|Tuesday|Wednesday|Thursday|Friday",
      "startTime": "HH:00",
      "endTime": "HH:00",
      "duration": "X hours",
      "format": "in-person|virtual|hybrid",
      "priority": "essential|high|optional",
      "expectedAttendance": "X-Y students",
      "mainTopics": ["Topic 1", "Topic 2"],
      "rationale": "Why this time slot is recommended"
    }
  ],
  "schedule": {
    "totalHoursRecommended": number,
    "distribution": "How hours are spread across week",
    "flexibility": "Options for instructor"
  },
  "insights": {
    "peakHelpTimes": ["Time periods"],
    "lowActivityPeriods": ["Time periods"],
    "virtualVsInPerson": "Recommendation on format"
  }
}`

    const analysisData = {
      hourlyActivity: hourlyActivity.map((h: any) => ({
        hour: parseInt(h.hour),
        dayOfWeek: parseInt(h.day_of_week),
        questionCount: parseInt(h.question_count),
        studentCount: parseInt(h.student_count),
        topics: h.topics
      })),
      studentPatterns: {
        totalActiveStudents: studentPatterns.length,
        averageQuestions: studentPatterns.reduce((sum: number, s: any) => 
          sum + parseInt(s.total_questions), 0) / studentPatterns.length
      },
      strugglePatterns: strugglePatterns.slice(0, 20).map((s: any) => ({
        topic: s.topic,
        hour: parseInt(s.hour),
        strugglingStudents: parseInt(s.struggling_students)
      }))
    }

    const { content } = await createForFeature(openai, "insights", {

      messages: [
        { role: "system", content: systemPrompt },
        { 
          role: "user", 
          content: `Optimize office hours schedule based on student activity:\n\n${JSON.stringify(analysisData, null, 2)}` 
        }
      ],
      temperature: 0.4,
      max_tokens: 3000,
      response_format: { type: "json_object" }
    })

    const optimization = JSON.parse(content || "{}")

    // Store recommendations
    await sql`
      INSERT INTO ai_instructor_insights (
        insight_type,
        data,
        created_at
      ) VALUES (
        'office_hours_optimization',
        ${JSON.stringify(optimization)},
        NOW()
      )
    `

    return NextResponse.json({
      success: true,
      ...optimization,
      dataAnalyzed: {
        timeSlots: hourlyActivity.length,
        activeStudents: studentPatterns.length,
        timeRange: `Last ${days} days`
      }
    })

  } catch (error: any) {
    console.error("[Office Hours Optimization Error]", error)
    return NextResponse.json(
      { 
        success: false, 
        error: "Failed to optimize office hours",
        recommendations: []
      },
      { status: 500 }
    )
  }
}

