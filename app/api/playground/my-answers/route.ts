import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireBoundStudentCaller } from "@/lib/student-api-auth"
import {
  getPlaygroundSessionByResultId,
  isClassroomSessionEnded,
  PLAYGROUND_SESSION_ENDED_MESSAGE,
} from "@/lib/playground-session-guard"

export const dynamic = "force-dynamic"

/**
 * GET /api/playground/my-answers?resultId=123
 * Returns previously submitted answers for a playground result (for resume / rejoin locking).
 */
export async function GET(request: NextRequest) {
  try {
    const bound = await requireBoundStudentCaller(
      request,
      request.headers.get("x-student-id") ?? request.nextUrl.searchParams.get("studentId"),
    )
    if (!bound.ok) return bound.response

    const resultId = Number(request.nextUrl.searchParams.get("resultId"))
    if (!Number.isFinite(resultId) || resultId <= 0) {
      return NextResponse.json({ error: "resultId required" }, { status: 400 })
    }

    const owned = await sql`
      SELECT 1
      FROM playground_results pr
      JOIN students s ON s.deleted_at IS NULL
        AND (s.student_id = pr.student_id OR pr.student_id = s.id::text)
      WHERE pr.id = ${resultId}
        AND s.id = ${bound.studentDbId}
      LIMIT 1
    `
    if (owned.length === 0) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    const session = await getPlaygroundSessionByResultId(resultId)
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }
    if (isClassroomSessionEnded(session)) {
      return NextResponse.json(
        { error: PLAYGROUND_SESSION_ENDED_MESSAGE, sessionEnded: true },
        { status: 403 },
      )
    }

    const rows = await sql`
      SELECT
        playground_question_id,
        selected_answer,
        is_correct,
        response_time_ms,
        time_taken_sec
      FROM playground_answers
      WHERE result_id = ${resultId}
      ORDER BY id ASC
    `

    return NextResponse.json({
      answers: rows.map((row: {
        playground_question_id: number
        selected_answer: string | null
        is_correct: boolean | null
        response_time_ms: number | null
        time_taken_sec: number | null
      }) => ({
        questionId: row.playground_question_id,
        selectedAnswer: row.selected_answer,
        isCorrect: Boolean(row.is_correct),
        responseTimeMs: row.response_time_ms,
        timeTakenSec: row.time_taken_sec,
      })),
    })
  } catch (error) {
    console.error("[playground/my-answers]", error)
    return NextResponse.json({ error: "Failed to load answers" }, { status: 500 })
  }
}
