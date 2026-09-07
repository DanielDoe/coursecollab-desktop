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
        pa.id,
        pa.topics,
        pa.difficulty,
        pa.total_questions,
        pa.correct_answers,
        pa.score_percentage,
        pa.time_spent_seconds,
        pa.completed_at,
        pa.started_at,
        COUNT(pans.id)::int AS answered_count,
        CASE
          WHEN pa.completed_at IS NOT NULL THEN 'completed'
          ELSE 'in_progress'
        END AS status
      FROM practice_attempts pa
      LEFT JOIN practice_answers pans ON pans.attempt_id = pa.id
      WHERE pa.student_id = ${auth.studentDbId}
        AND (
          pa.completed_at IS NOT NULL
          OR EXISTS (
            SELECT 1 FROM practice_answers x WHERE x.attempt_id = pa.id LIMIT 1
          )
        )
      GROUP BY pa.id
      ORDER BY COALESCE(pa.completed_at, pa.started_at) DESC
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
