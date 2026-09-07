import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireInstructorSession } from "@/lib/instructor-session-auth"
import {
  countPlaygroundRows,
  logPlaygroundDeleteAudit,
} from "@/lib/playground-delete-audit"
import {
  checkPlaygroundStudentDataDeleteAllowed,
  playgroundDeleteGuardResponse,
} from "@/lib/playground-production-guard"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const session = await requireInstructorSession(request)
    if (!session.ok) return session.response

    const { sessionId, confirmPhrase } = await request.json()

    if (!sessionId) {
      return NextResponse.json({ error: "Session ID is required" }, { status: 400 })
    }

    const sessionIdNum = Number(sessionId)
    const sessionRows = await sql`
      SELECT is_active FROM playground_sessions WHERE id = ${sessionIdNum} LIMIT 1
    `
    if (sessionRows.length === 0) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    const isActive = Boolean(sessionRows[0]?.is_active)
    const rowsBefore = await countPlaygroundRows({ sessionId: sessionIdNum })

    const guard = checkPlaygroundStudentDataDeleteAllowed({
      bulk: false,
      confirmPhrase,
      studentResultRows: rowsBefore.results,
      allowLiveSessionReset: isActive && rowsBefore.results > 0,
    })
    if (guard.blocked) return playgroundDeleteGuardResponse(guard)

    await sql`
      DELETE FROM playground_results
      WHERE session_id = ${sessionIdNum}
    `

    await logPlaygroundDeleteAudit({
      source: "api:playground/admin/reset",
      actorType: "system",
      sessionId: sessionIdNum,
      rowsBefore,
      rowsDeleted: { results: rowsBefore.results },
      metadata: { note: "admin reset leaderboard", live_session: isActive },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: "Failed to reset leaderboard" }, { status: 500 })
  }
}
