import { type NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { sql } from "@/lib/db"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function GET(request: NextRequest) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const { searchParams } = new URL(request.url)
    const examId = searchParams.get("examId")

    if (!examId) {
      return NextResponse.json({ error: "Exam ID required" }, { status: 400 })
    }

    // Fetch all comments from quiz_issues table
    const comments = await sql`
      SELECT 
        qi.id,
        qi.description as text,
        qi.created_at,
        qi.reporter_name as author,
        qi.reporter_id as student_id,
        'student' as author_type,
        qi.status
      FROM quiz_issues qi
      JOIN quizzes q ON qi.quiz_id = q.id
      WHERE qi.quiz_id = ${examId}
        AND qi.issue_type = 'comment'
        AND q.assessment_type = 'mid_semester'
      ORDER BY qi.created_at ASC
    `

    return NextResponse.json({ comments })
  } catch (error) {
    console.error("[v0] Error fetching admin comments:", error)
    return NextResponse.json({ error: "Failed to fetch comments" }, { status: 500 })
  }
}
