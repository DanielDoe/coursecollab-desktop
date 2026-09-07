import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const threshold = parseInt(searchParams.get("threshold") || "5")
    const hours = parseInt(searchParams.get("hours") || "6")

    // Detect students asking many questions about same topic
    const warnings = await sql`
      WITH topic_questions AS (
        SELECT 
          student_id,
          topic,
          COUNT(*) as question_count,
          ARRAY_AGG(message ORDER BY created_at DESC) as recent_questions,
          MIN(created_at) as first_question,
          MAX(created_at) as last_question,
          EXTRACT(EPOCH FROM (MAX(created_at) - MIN(created_at)))/3600 as time_span_hours
        FROM ai_tutor_conversations
        WHERE 
          created_at >= NOW() - INTERVAL '${hours} hours'
          AND topic IS NOT NULL
          AND topic != ''
        GROUP BY student_id, topic
        HAVING COUNT(*) >= ${threshold}
      )
      SELECT 
        tq.student_id,
        s.full_name,
        s.student_id as student_number,
        s.section,
        s.email,
        tq.topic,
        tq.question_count,
        tq.recent_questions,
        tq.first_question,
        tq.last_question,
        tq.time_span_hours,
        CASE 
          WHEN tq.question_count >= 10 THEN 'critical'
          WHEN tq.question_count >= 7 THEN 'high'
          WHEN tq.question_count >= ${threshold} THEN 'medium'
          ELSE 'low'
        END as severity
      FROM topic_questions tq
      JOIN students s ON tq.student_id = s.id
      ORDER BY tq.question_count DESC, tq.last_question DESC
    `

    // Get historical pattern for each student
    const warningsWithHistory = await Promise.all(
      warnings.map(async (warning: any) => {
        const history = await sql`
          SELECT 
            COUNT(*) as total_questions,
            COUNT(DISTINCT topic) as topics_asked_about,
            COUNT(DISTINCT DATE(created_at)) as active_days
          FROM ai_tutor_conversations
          WHERE 
            student_id = ${warning.student_id}
            AND created_at >= NOW() - INTERVAL '14 days'
        `

        return {
          ...warning,
          historicalPattern: {
            totalQuestions: parseInt(history[0]?.total_questions || 0),
            topicsAskedAbout: parseInt(history[0]?.topics_asked_about || 0),
            activeDays: parseInt(history[0]?.active_days || 0)
          },
          isRepeatedPattern: parseInt(history[0]?.total_questions || 0) > threshold * 2
        }
      })
    )

    // Create summary stats
    const summary = {
      totalWarnings: warningsWithHistory.length,
      critical: warningsWithHistory.filter((w: any) => w.severity === 'critical').length,
      high: warningsWithHistory.filter((w: any) => w.severity === 'high').length,
      medium: warningsWithHistory.filter((w: any) => w.severity === 'medium').length,
      uniqueStudents: new Set(warningsWithHistory.map((w: any) => w.student_id)).size,
      mostCommonTopic: warningsWithHistory.length > 0 
        ? warningsWithHistory.reduce((acc: any, curr: any) => {
            acc[curr.topic] = (acc[curr.topic] || 0) + 1
            return acc
          }, {})
        : {}
    }

    return NextResponse.json({
      success: true,
      warnings: warningsWithHistory,
      summary,
      configuration: {
        threshold,
        hours,
        timeRange: `Last ${hours} hours`
      }
    })

  } catch (error: any) {
    console.error("[Early Warning System Error]", error)
    return NextResponse.json(
      { 
        success: false, 
        error: "Failed to fetch early warnings",
        warnings: [],
        summary: {
          totalWarnings: 0,
          critical: 0,
          high: 0,
          medium: 0,
          uniqueStudents: 0,
          mostCommonTopic: {}
        }
      },
      { status: 500 }
    )
  }
}

