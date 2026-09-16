import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { normalizePracticeScorePercent } from "@/lib/practice-score-display"
import { checkPracticeHubAccess } from "@/lib/practice-hub-access-server"
import { requireStudentPracticeCaller } from "@/lib/require-student-practice-auth"



export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const studentId = searchParams.get("studentId")

    const auth = await requireStudentPracticeCaller(request, studentId)
    if (!auth.ok) return auth.response

    const hubAccess = await checkPracticeHubAccess(auth.studentDbId)
    if (!hubAccess.allowed) return hubAccess.deniedResponse!

    const attempts = await sql`
      SELECT 
        id,
        topics,
        difficulty,
        total_questions,
        correct_answers,
        score_percentage,
        time_spent_seconds,
        completed_at
      FROM practice_attempts
      WHERE student_id = ${auth.studentDbId}
        AND completed_at IS NOT NULL
      ORDER BY completed_at DESC
    `

    const normalized = (attempts as Array<Record<string, unknown>>).map((row) => ({
      ...row,
      score_percentage: normalizePracticeScorePercent(row.score_percentage),
    }))

    return NextResponse.json({ attempts: normalized })
  } catch (error) {
    console.error("[v0] Error fetching practice history:", error)
    return NextResponse.json({ error: "Failed to fetch history" }, { status: 500 })
  }
}
