import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireInstructorSession } from "@/lib/instructor-session-auth"

export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function POST(request: NextRequest) {
  try {
    const session = await requireInstructorSession(request)
    if (!session.ok) return session.response

    const { sessionId } = await request.json()

    if (!sessionId) {
      return NextResponse.json({ error: "Session ID is required" }, { status: 400 })
    }

    // End the session
    await sql`
      UPDATE playground_sessions
      SET is_active = false, ended_at = CURRENT_TIMESTAMP
      WHERE id = ${sessionId}
    `

    // Get session summary
    const summary = await sql`
      SELECT 
        COUNT(*) as total_participants,
        AVG(score) as avg_score,
        MAX(score) as top_score
      FROM playground_results
      WHERE session_id = ${sessionId}
    `

    // Get top 3 players
    const topPlayers = await sql`
      SELECT student_name, score
      FROM playground_results
      WHERE session_id = ${sessionId}
      ORDER BY score DESC
      LIMIT 3
    `

    return NextResponse.json({
      summary: {
        totalParticipants: summary[0].total_participants,
        avgScore: Math.round(summary[0].avg_score || 0),
        topScore: summary[0].top_score || 0,
        topPlayers: topPlayers.map((p: any) => ({
          name: p.student_name,
          score: p.score,
        })),
      },
    })
  } catch (error) {
    return NextResponse.json({ error: "Failed to stop session" }, { status: 500 })
  }
}
