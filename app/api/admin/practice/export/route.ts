import { type NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { sql } from "@/lib/db"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function GET(request: NextRequest) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const attempts = await sql`
      SELECT 
        s.student_id,
        s.full_name,
        s.session_id,
        pa.topics,
        pa.difficulty,
        pa.total_questions,
        pa.correct_answers,
        pa.score_percentage,
        pa.time_spent_seconds,
        pa.started_at,
        pa.completed_at
      FROM practice_attempts pa
      JOIN students s ON pa.student_id = s.id
      WHERE pa.completed_at IS NOT NULL
      ORDER BY pa.completed_at DESC
    `

    // Convert to CSV
    const headers = [
      "Student ID",
      "Student Name",
      "Session",
      "Topics",
      "Difficulty",
      "Total Questions",
      "Correct Answers",
      "Score %",
      "Time Spent (seconds)",
      "Started At",
      "Completed At",
    ]

    const rows = attempts.map((attempt) => [
      attempt.student_id,
      attempt.full_name,
      attempt.session_id,
      Array.isArray(attempt.topics) ? attempt.topics.join("; ") : attempt.topics,
      attempt.difficulty,
      attempt.total_questions,
      attempt.correct_answers,
      attempt.score_percentage,
      attempt.time_spent_seconds,
      attempt.started_at,
      attempt.completed_at,
    ])

    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n")

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="practice-analytics-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    })
  } catch (error) {
    console.error("[v0] Error exporting practice data:", error)
    return NextResponse.json({ error: "Failed to export data" }, { status: 500 })
  }
}
