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

    const studentLookup = await sql`
      SELECT student_id FROM students
      WHERE id = ${bound.studentDbId} AND deleted_at IS NULL
      LIMIT 1
    `
    if (studentLookup.length === 0) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 })
    }
    const studentIdString = studentLookup[0].student_id

    // Fetch all playground results for this student (both CLASSROOM and PERSONAL modes)
    // Match leaderboard logic - show all results with scores, regardless of completion status
    const results = await sql`
      SELECT 
        pr.score,
        pr.questions_answered,
        pr.correct_answers,
        pr.completed_at,
        pr.student_id,
        ps.question_count
      FROM playground_results pr
      JOIN playground_sessions ps ON pr.session_id = ps.id
      WHERE pr.student_id = ${studentIdString}
        AND pr.score > 0
      ORDER BY COALESCE(pr.completed_at, ps.created_at) DESC
    `

    // Only return scores if there are actual results for this student
    // If no results, return 0 scores and 0 totalGames
    if (results.length === 0) {
      return NextResponse.json({
        bestScore: 0,
        averageScore: 0,
        totalGames: 0,
      })
    }

    // Calculate best score
    const bestScore = Math.max(...results.map((r: any) => r.score || 0))

    // Calculate average score
    const averageScore = Math.round(results.reduce((sum: number, r: any) => sum + (r.score || 0), 0) / results.length)

    return NextResponse.json({
      bestScore,
      averageScore,
      totalGames: results.length,
    })
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch playground scores" }, { status: 500 })
  }
}

