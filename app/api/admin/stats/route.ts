import { type NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { sql } from "@/lib/db"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function GET(request: NextRequest) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    // Get total quizzes
    const quizzesResult = await sql`
      SELECT COUNT(*) as total
      FROM quizzes
    `

    // Get total students
    const studentsResult = await sql`
      SELECT COUNT(*) as total FROM students
    `

    // Get total attempts
    const attemptsResult = await sql`
      SELECT COUNT(*) as total FROM quiz_attempts
    `

    return NextResponse.json({
      totalQuizzes: Number(quizzesResult[0].total),
      activeQuizzes: Number(quizzesResult[0].total), // All quizzes are considered active
      totalStudents: Number(studentsResult[0].total),
      totalAttempts: Number(attemptsResult[0].total),
    })
  } catch (error) {
    console.error("[v0] Failed to fetch stats:", error)
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 })
  }
}
