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
        COUNT(DISTINCT s.id) as total_students,
        COUNT(DISTINCT CASE WHEN qa.completed_at >= NOW() - INTERVAL '7 days' THEN s.id END) as active_students,
        COUNT(qa.id) as total_attempts,
        AVG(qa.score) as average_score,
        COUNT(CASE WHEN qa.score >= 80 THEN 1 END) as high_performers
      FROM students s
      LEFT JOIN quiz_attempts qa ON s.id = qa.student_id
      LEFT JOIN quizzes q ON qa.quiz_id = q.id
      WHERE q.instructor_id = ${instructorId}
    `

    const sessionStats = await sql`
      SELECT 
        s.session_code,
        COUNT(s.id) as student_count,
        AVG(qa.score) as average_score,
        COUNT(qa.id) as total_attempts
      FROM students s
      LEFT JOIN quiz_attempts qa ON s.id = qa.student_id
      LEFT JOIN quizzes q ON qa.quiz_id = q.id
      WHERE q.instructor_id = ${instructorId}
      GROUP BY s.session_code
      ORDER BY student_count DESC
    `

    return NextResponse.json({ 
      stats: stats[0],
      sessionStats 
    })
  } catch (error) {
    console.error("Error fetching student stats:", error)
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 })
  }
}

