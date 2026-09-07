import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireStudentPracticeCaller } from "@/lib/require-student-practice-auth"

export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const studentId = searchParams.get("studentId")
    const session = searchParams.get("session")
    const courseIdParam = searchParams.get("courseId")

    const auth = await requireStudentPracticeCaller(request, studentId, session, courseIdParam)
    if (!auth.ok) return auth.response
    const { courseId, practiceSession } = auth.ctx

    // Get student's stats
    const studentStats = await sql`
      SELECT 
        total_practice_points,
        avg_practice_score,
        current_streak_days
      FROM practice_leaderboard
      WHERE student_id = ${auth.ctx.studentDbId}
    `

    const classAverage = await sql`
      SELECT 
        AVG(pl.total_practice_points) as avg_points,
        AVG(pl.avg_practice_score) as avg_score,
        AVG(pl.current_streak_days) as avg_streak
      FROM practice_leaderboard pl
      INNER JOIN students s ON s.id = pl.student_id
      WHERE s.course_id = ${courseId}
        AND (
          ${practiceSession} = 'ALL'
          OR TRIM(s.section::text) = TRIM(${practiceSession}::text)
        )
    `

    const topPerformer = await sql`
      SELECT 
        pl.total_practice_points,
        pl.avg_practice_score,
        pl.current_streak_days
      FROM practice_leaderboard pl
      INNER JOIN students s ON s.id = pl.student_id
      WHERE s.course_id = ${courseId}
        AND (
          ${practiceSession} = 'ALL'
          OR TRIM(s.section::text) = TRIM(${practiceSession}::text)
        )
      ORDER BY pl.total_practice_points DESC
      LIMIT 1
    `

    return NextResponse.json({
      student: studentStats[0] || { total_practice_points: 0, avg_practice_score: 0, current_streak_days: 0 },
      classAverage: classAverage[0] || { avg_points: 0, avg_score: 0, avg_streak: 0 },
      topPerformer: topPerformer[0] || { total_practice_points: 0, avg_practice_score: 0, current_streak_days: 0 },
      courseId,
    })
  } catch (error) {
    console.error("[v0] Failed to fetch comparison data:", error)
    return NextResponse.json({ error: "Failed to fetch comparison" }, { status: 500 })
  }
}
