import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireBoundStudentCaller } from "@/lib/student-api-auth"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const studentId = searchParams.get("studentId")

    if (!studentId) {
      return NextResponse.json({ error: "Student ID is required" }, { status: 400 })
    }

    const bound = await requireBoundStudentCaller(request, studentId)
    if (!bound.ok) return bound.response

    const studentRows = await sql`
      SELECT student_id FROM students
      WHERE id = ${bound.studentDbId} AND deleted_at IS NULL
      LIMIT 1
    `
    if (studentRows.length === 0) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 })
    }

    const rosterStudentId = String(studentRows[0].student_id)

    const history = await sql`
      SELECT 
        pr.score,
        pr.questions_answered,
        pr.correct_answers,
        pr.completed_at
      FROM playground_results pr
      JOIN playground_sessions ps ON pr.session_id = ps.id
      WHERE pr.student_id = ${rosterStudentId}
        AND ps.mode = 'PERSONAL'
      ORDER BY pr.completed_at DESC NULLS LAST, pr.id DESC
      LIMIT 10
    `

    const scores = history.map((h: { score: number | null }) => Number(h.score ?? 0))
    const bestScore = scores.length > 0 ? Math.max(...scores) : 0
    const avgScore =
      scores.length > 0 ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length) : 0

    return NextResponse.json({
      bestScore,
      avgScore,
      totalGames: history.length,
      recentGames: history.map((h: Record<string, unknown>) => ({
        score: Number(h.score ?? 0),
        questionsAnswered: Number(h.questions_answered ?? 0),
        correctAnswers: Number(h.correct_answers ?? 0),
        completedAt: (h.completed_at as string | null) ?? null,
      })),
    })
  } catch (error) {
    console.error("[playground/personal]", error)
    return NextResponse.json({ error: "Failed to fetch personal leaderboard" }, { status: 500 })
  }
}
