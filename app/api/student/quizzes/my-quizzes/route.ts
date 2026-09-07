import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireCallerStudentDbId } from "@/lib/student-api-auth"



export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const auth = await requireCallerStudentDbId(request)
    if (!auth.ok) return auth.response
    const studentInternalId = auth.studentDbId

    const quizzes = await sql`
      SELECT 
        uq.id,
        uq.title,
        uq.description,
        uq.is_public,
        uq.created_at,
        COUNT(DISTINCT uqq.id) as question_count,
        COUNT(DISTINCT uqa.id) as attempt_count
      FROM user_quizzes uq
      LEFT JOIN user_quiz_questions uqq ON uq.id = uqq.user_quiz_id
      LEFT JOIN user_quiz_attempts uqa ON uq.id = uqa.user_quiz_id
      WHERE uq.created_by = ${studentInternalId}
      GROUP BY uq.id, uq.title, uq.description, uq.is_public, uq.created_at
      ORDER BY uq.created_at DESC
    `

    return NextResponse.json({ quizzes })
  } catch (error) {
    console.error("[v0] Failed to fetch user quizzes:", error)
    return NextResponse.json({ error: "Failed to fetch quizzes" }, { status: 500 })
  }
}
