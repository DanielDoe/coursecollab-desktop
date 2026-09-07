import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireInstructorSession } from "@/lib/instructor-session-auth"

export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function GET(request: NextRequest) {
  try {
    const auth = await requireInstructorSession(request)
    if (!auth.ok) return auth.response

    // Get active classroom session
    const activeSessions = await sql`
      SELECT id, duration_sec, created_at, is_active
      FROM playground_sessions
      WHERE mode = 'CLASSROOM' AND is_active = true
      ORDER BY created_at DESC
      LIMIT 1
    `

    if (activeSessions.length === 0) {
      return NextResponse.json({ activeSession: null })
    }

    const session = activeSessions[0]

    // Get participant count
    const participants = await sql`
      SELECT COUNT(*) as count
      FROM playground_results
      WHERE session_id = ${session.id}
    `

    return NextResponse.json({
      activeSession: {
        id: session.id,
        durationSec: session.duration_sec,
        createdAt: session.created_at,
        participantCount: participants[0].count,
      },
    })
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch status" }, { status: 500 })
  }
}
