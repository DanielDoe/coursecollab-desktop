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
        COUNT(*) as total_questions,
        COUNT(CASE WHEN difficulty = 'easy' THEN 1 END) as easy_questions,
        COUNT(CASE WHEN difficulty = 'medium' THEN 1 END) as medium_questions,
        COUNT(CASE WHEN difficulty = 'hard' THEN 1 END) as hard_questions,
        COUNT(DISTINCT topic) as unique_topics
      FROM questions 
      WHERE instructor_id = ${instructorId}
    `

    const topics = await sql`
      SELECT 
        topic,
        COUNT(*) as question_count,
        AVG(CASE 
          WHEN difficulty = 'easy' THEN 1
          WHEN difficulty = 'medium' THEN 2
          WHEN difficulty = 'hard' THEN 3
          ELSE 0
        END) as average_difficulty
      FROM questions 
      WHERE instructor_id = ${instructorId}
      GROUP BY topic
      ORDER BY question_count DESC
    `

    return NextResponse.json({ 
      stats: stats[0],
      topics 
    })
  } catch (error) {
    console.error("Error fetching question bank stats:", error)
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 })
  }
}

