import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"



export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const studentId = searchParams.get("studentId")

    if (!studentId) {
      return NextResponse.json({ error: "Student ID is required" }, { status: 400 })
    }

    // Get student database ID
    const studentResult = await sql`
      SELECT id FROM students WHERE student_id = ${studentId} LIMIT 1
    `

    if (studentResult.length === 0) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 })
    }

    const studentDatabaseId = studentResult[0].id

    // Get quiz completion stats
    // CRITICAL: Calculate percentage using total_possible_points (sum of max_points) not total_questions (count)
    const quizStats = await sql`
      SELECT 
        COUNT(DISTINCT qa.quiz_id) as completed_quizzes,
        COUNT(DISTINCT q.id) as total_quizzes,
        COALESCE(
          AVG(
            CASE 
              WHEN qa.completed_at IS NOT NULL THEN 
                (qa.score::float / NULLIF(
                  (SELECT SUM(COALESCE(qq.max_points, qq.points, 1)) FROM quiz_questions qq WHERE qq.quiz_id = q.id),
                  0
                )) * 100
              ELSE NULL
            END
          ),
          0
        ) as avg_score
      FROM quizzes q
      LEFT JOIN quiz_attempts qa ON q.id = qa.quiz_id AND qa.student_id = ${studentDatabaseId}
      WHERE q.is_public = true AND q.assessment_type = 'quiz'
    `

    // Get practice stats
    const practiceStats = await sql`
      SELECT 
        COUNT(*) as practice_sessions,
        COALESCE(AVG((correct_answers::float / total_questions) * 100), 0) as practice_accuracy
      FROM practice_attempts
      WHERE student_id = ${studentDatabaseId}
        AND completed_at IS NOT NULL
    `

    const quizCompletion =
      quizStats[0].total_quizzes > 0
        ? Math.round((quizStats[0].completed_quizzes / quizStats[0].total_quizzes) * 100)
        : 0

    const practiceAccuracy = Math.round(practiceStats[0].practice_accuracy || 0)
    const avgQuizScore = Math.round(quizStats[0].avg_score || 0)

    // Calculate confidence level (weighted average)
    const confidenceLevel = Math.round(quizCompletion * 0.4 + practiceAccuracy * 0.3 + avgQuizScore * 0.3)

    return NextResponse.json({
      quizCompletion,
      practiceAccuracy,
      confidenceLevel,
      completedQuizzes: quizStats[0].completed_quizzes,
      totalQuizzes: quizStats[0].total_quizzes,
      practiceSessions: practiceStats[0].practice_sessions,
    })
  } catch (error) {
    console.error("[v0] Failed to fetch exam readiness:", error)
    return NextResponse.json({ error: "Failed to fetch exam readiness" }, { status: 500 })
  }
}
