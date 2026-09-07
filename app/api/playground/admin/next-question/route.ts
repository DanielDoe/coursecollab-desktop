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

    // Increment current_question_index
    const updated = await sql`
      UPDATE playground_sessions
      SET current_question_index = current_question_index + 1
      WHERE id = ${sessionId} AND is_active = true
      RETURNING current_question_index
    `

    if (updated.length === 0) {
      return NextResponse.json({ error: "Session not found or inactive" }, { status: 404 })
    }

    return NextResponse.json({
      currentQuestionIndex: updated[0].current_question_index,
    })
  } catch (error) {
    return NextResponse.json({ error: "Failed to advance question" }, { status: 500 })
  }
}
