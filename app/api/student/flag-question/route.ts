import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function POST(request: NextRequest) {
  try {
    const { attemptId, questionId, isFlagged } = await request.json()

    if (!attemptId || !questionId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    if (isFlagged) {
      // Flag the question
      await sql`
        INSERT INTO question_flags (attempt_id, question_id, is_flagged, flagged_at)
        VALUES (${attemptId}, ${questionId}, true, NOW())
        ON CONFLICT (attempt_id, question_id) 
        DO UPDATE SET is_flagged = true, flagged_at = NOW(), unflagged_at = NULL
      `
    } else {
      // Unflag the question
      await sql`
        INSERT INTO question_flags (attempt_id, question_id, is_flagged, unflagged_at)
        VALUES (${attemptId}, ${questionId}, false, NOW())
        ON CONFLICT (attempt_id, question_id) 
        DO UPDATE SET is_flagged = false, unflagged_at = NOW()
      `
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Failed to flag question:", error)
    return NextResponse.json({ error: "Failed to flag question" }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const attemptId = searchParams.get("attemptId")

    if (!attemptId) {
      return NextResponse.json({ error: "Missing attemptId" }, { status: 400 })
    }

    const flags = await sql`
      SELECT question_id, is_flagged
      FROM question_flags
      WHERE attempt_id = ${attemptId}
    `

    const flaggedQuestions = flags.filter((f) => f.is_flagged).map((f) => f.question_id)

    return NextResponse.json({ flaggedQuestions })
  } catch (error) {
    console.error("[v0] Failed to get flagged questions:", error)
    return NextResponse.json({ error: "Failed to get flagged questions" }, { status: 500 })
  }
}
