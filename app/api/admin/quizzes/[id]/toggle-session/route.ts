import { type NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { sql } from "@/lib/db"
import { resolveAllSessionRowsByCode } from "@/lib/resolve-session-by-code"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const { session_code, is_active } = await request.json()
    const quizId = params.id

    const meta = await sql`
      SELECT course_id FROM quizzes WHERE id = ${quizId} LIMIT 1
    `
    if (!meta.length) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 })
    }
    const courseId = (meta[0] as { course_id: number | null }).course_id

    const sessionRows = await resolveAllSessionRowsByCode(String(session_code ?? ""), courseId)
    if (sessionRows.length === 0) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    for (const session of sessionRows) {
      await sql`
        INSERT INTO quiz_session_access (quiz_id, session_id, is_active, updated_at)
        VALUES (${quizId}, ${session.id}, ${is_active}, CURRENT_TIMESTAMP)
        ON CONFLICT (quiz_id, session_id)
        DO UPDATE SET 
          is_active = ${is_active}, 
          updated_at = CURRENT_TIMESTAMP
      `
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Failed to toggle quiz session status:", error)
    return NextResponse.json({ error: "Failed to toggle quiz" }, { status: 500 })
  }
}
