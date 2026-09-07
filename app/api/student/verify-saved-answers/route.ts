import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const attemptId = searchParams.get("attemptId")

    if (!attemptId) {
      return NextResponse.json({ error: "Missing attemptId" }, { status: 400 })
    }

    // Get all question IDs that have answers saved in the database
    const savedAnswers = await sql`
      SELECT DISTINCT question_id
      FROM quiz_answers
      WHERE attempt_id = ${parseInt(attemptId)}
        AND (selected_answer IS NOT NULL OR answer_data IS NOT NULL)
    `

    const savedQuestionIds = savedAnswers.map((row: any) => row.question_id)

    return NextResponse.json({
      success: true,
      savedQuestionIds,
      count: savedQuestionIds.length
    })
  } catch (error) {
    console.error("[Verify Saved Answers] Error:", error)
    return NextResponse.json(
      {
        error: "Failed to verify saved answers",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}

