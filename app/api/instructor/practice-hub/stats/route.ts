import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function GET(request: NextRequest) {
  try {
    const instructorId = request.nextUrl.searchParams.get("instructorId")
    
    if (!instructorId) {
      return NextResponse.json({ error: "Instructor ID required" }, { status: 400 })
    }

    const stats = await sql`
      SELECT 
        COUNT(DISTINCT pa.student_id) as active_students,
        COUNT(pa.id) as total_attempts,
        AVG(pa.score) as average_score,
        COUNT(CASE WHEN pa.completed_at IS NOT NULL THEN 1 END) as completed_attempts
      FROM practice_attempts pa
      JOIN students s ON pa.student_id = s.id
      WHERE pa.created_at >= NOW() - INTERVAL '30 days'
    `

    const topicStats = await sql`
      SELECT 
        q.topic,
        COUNT(pa.id) as attempt_count,
        AVG(pa.score) as average_score,
        COUNT(DISTINCT pa.student_id) as unique_students
      FROM practice_attempts pa
      JOIN questions q ON pa.question_id = q.id
      WHERE pa.created_at >= NOW() - INTERVAL '30 days'
      GROUP BY q.topic
      ORDER BY attempt_count DESC
    `

    return NextResponse.json({ 
      stats: stats[0],
      topicStats 
    })
  } catch (error) {
    console.error("Error fetching practice stats:", error)
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 })
  }
}

