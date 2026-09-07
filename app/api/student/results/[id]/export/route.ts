import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireAttemptOwnership } from "@/lib/student-api-auth"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const attemptId = params.id

    const ownership = await requireAttemptOwnership(request, parseInt(attemptId, 10))
    if (!ownership.ok) return ownership.response

    // Get attempt details with student info
    const attemptResult = await sql`
      SELECT 
        qa.*,
        q.title as quiz_title,
        s.full_name as student_name,
        s.student_id,
        s.section
      FROM quiz_attempts qa
      JOIN quizzes q ON qa.quiz_id = q.id
      JOIN students s ON qa.student_id = s.id
      WHERE qa.id = ${attemptId}
    `

    if (attemptResult.length === 0) {
      return NextResponse.json({ error: "Results not found" }, { status: 404 })
    }

    const attempt = attemptResult[0]

    // Get total possible points for percentage calculation
    const totalPointsResult = await sql`
      SELECT SUM(COALESCE(max_points, points, 1)) as total_points
      FROM quiz_questions
      WHERE quiz_id = ${attempt.quiz_id}
    `
    const totalPossiblePoints = parseFloat(totalPointsResult[0]?.total_points || 0) || attempt.total_questions

    // Get detailed answers
    const answers = await sql`
      SELECT 
        q.question_text,
        q.option_a,
        q.option_b,
        q.option_c,
        q.option_d,
        q.correct_answer,
        sa.selected_answer,
        sa.is_correct,
        q.question_order
      FROM student_answers sa
      JOIN questions q ON sa.question_id = q.id
      WHERE sa.attempt_id = ${attemptId}
      ORDER BY q.question_order ASC
    `

    // CRITICAL: Calculate percentage using total_possible_points (sum of max_points) not total_questions (count)
    const percentage = totalPossiblePoints > 0 
      ? Math.round((attempt.score / totalPossiblePoints) * 100)
      : 0

    // Generate CSV
    const headers = ["Question #", "Question Text", "Your Answer", "Correct Answer", "Result"]

    const csvRows = [
      `Student: ${attempt.student_name} (${attempt.student_id})`,
      `Section: ${attempt.section}`,
      `Quiz: ${attempt.quiz_title}`,
      `Score: ${attempt.score}/${attempt.total_questions} (${percentage}%)`,
      `Completed: ${new Date(attempt.completed_at).toLocaleString()}`,
      "",
      headers.join(","),
    ]

    for (let i = 0; i < answers.length; i++) {
      const answer = answers[i]
      const row = [
        i + 1,
        `"${answer.question_text.replace(/"/g, '""')}"`,
        answer.selected_answer || "No Answer",
        answer.correct_answer,
        answer.is_correct ? "Correct" : "Incorrect",
      ]
      csvRows.push(row.join(","))
    }

    const csv = csvRows.join("\n")

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="quiz-results-${attempt.student_id}-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    })
  } catch (error) {
    console.error("[v0] Failed to export results:", error)
    return NextResponse.json({ error: "Failed to export results" }, { status: 500 })
  }
}
