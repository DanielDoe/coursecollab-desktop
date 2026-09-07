import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requirePracticeAttemptOwnership } from "@/lib/require-student-practice-auth"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function GET(request: NextRequest, { params }: { params: { attemptId: string } }) {
  try {
    const { attemptId } = params
    const auth = await requirePracticeAttemptOwnership(request, Number(attemptId))
    if (!auth.ok) return auth.response

    const result = await sql`
      SELECT 
        topics,
        difficulty,
        total_questions,
        correct_answers,
        score_percentage,
        time_spent_seconds,
        completed_at
      FROM practice_attempts
      WHERE id = ${attemptId}
    `

    if (result.length === 0) {
      return NextResponse.json({ error: "Results not found" }, { status: 404 })
    }

    return NextResponse.json({ result: result[0] })
  } catch (error) {
    console.error("[v0] Error fetching practice results:", error)
    return NextResponse.json({ error: "Failed to fetch results" }, { status: 500 })
  }
}
