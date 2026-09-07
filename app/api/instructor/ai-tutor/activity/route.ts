import { type NextRequest, NextResponse } from "next/server"
import { getSQL } from "@/lib/db"

export async function GET(request: NextRequest) {
  try {
    const sql = getSQL()

    // Fetch student activity data
    const studentActivity = await sql`
      SELECT 
        s.id,
        s.full_name as name,
        s.student_id,
        s.section,
        MAX(atc.created_at) as last_active,
        COUNT(atc.id) as questions_asked,
        AVG(atc.satisfaction_score) as satisfaction_score,
        ARRAY_AGG(DISTINCT atc.topic) FILTER (WHERE atc.topic IS NOT NULL) as weak_topics,
        ARRAY_AGG(DISTINCT ats.topic) FILTER (WHERE ats.topic IS NOT NULL) as struggling_areas,
        CASE 
          WHEN COUNT(atc.id) > LAG(COUNT(atc.id)) OVER (PARTITION BY s.id ORDER BY DATE_TRUNC('week', atc.created_at)) THEN 'up'
          WHEN COUNT(atc.id) < LAG(COUNT(atc.id)) OVER (PARTITION BY s.id ORDER BY DATE_TRUNC('week', atc.created_at)) THEN 'down'
          ELSE 'stable'
        END as progress_trend
      FROM students s
      LEFT JOIN ai_tutor_conversations atc ON s.id = atc.student_id
      LEFT JOIN ai_tutor_struggles ats ON s.id = ats.student_id AND ats.status IN ('new', 'reviewed')
      WHERE atc.created_at IS NOT NULL
      GROUP BY s.id, s.full_name, s.student_id, s.section
      ORDER BY questions_asked DESC
    `

    // Format the response
    const formattedActivity = studentActivity.map(student => ({
      id: student.id,
      name: student.name || "Unknown Student",
      studentId: student.student_id || "N/A",
      section: student.section || "N/A",
      lastActive: student.last_active ? getTimeAgo(new Date(student.last_active)) : "Never",
      questionsAsked: student.questions_asked || 0,
      satisfactionScore: Math.round((student.satisfaction_score || 0) * 10) / 10,
      weakTopics: student.weak_topics || [],
      strugglingAreas: student.struggling_areas || [],
      progressTrend: student.progress_trend || "stable"
    }))

    return NextResponse.json({ activity: formattedActivity })
  } catch (error) {
    console.error("[v0] Failed to fetch student activity:", error)
    return NextResponse.json({ error: "Failed to fetch student activity" }, { status: 500 })
  }
}

function getTimeAgo(date: Date): string {
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)
  
  if (diffInSeconds < 60) return "Just now"
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`
  
  return date.toLocaleDateString()
}
