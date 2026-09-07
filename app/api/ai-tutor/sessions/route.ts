import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

export async function GET(request: NextRequest) {
  try {
    const studentId = request.nextUrl.searchParams.get("studentId")
    if (!studentId) {
      return NextResponse.json({ error: "Student ID required" }, { status: 400 })
    }

    // Fetch recent sessions
    const sessions = await sql`
      SELECT 
        id,
        topic,
        duration_minutes,
        questions_answered,
        accuracy_percentage,
        created_at
      FROM ai_tutor_sessions 
      WHERE student_id = ${studentId}
      ORDER BY created_at DESC
      LIMIT 10
    `

    return NextResponse.json({ 
      sessions: sessions.map(session => ({
        id: session.id,
        topic: session.topic,
        duration: session.duration_minutes,
        questionsAnswered: session.questions_answered,
        accuracy: session.accuracy_percentage,
        timestamp: session.created_at
      }))
    })
  } catch (error) {
    console.error("[v0] Failed to fetch sessions:", error)
    return NextResponse.json({ error: "Failed to fetch sessions" }, { status: 500 })
  }
}

