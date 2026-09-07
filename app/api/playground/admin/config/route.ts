import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireInstructorSession } from "@/lib/instructor-session-auth"

export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function POST(request: NextRequest) {
  try {
    const session = await requireInstructorSession(request)
    if (!session.ok) return session.response

    const { sessionId, durationSec } = await request.json()

    if (!sessionId || !durationSec) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Update session configuration
    await sql`
      UPDATE playground_sessions
      SET duration_sec = ${durationSec}
      WHERE id = ${sessionId}
    `

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: "Failed to update configuration" }, { status: 500 })
  }
}
