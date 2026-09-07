import { type NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { sql } from "@/lib/db"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const midSemesterId = Number.parseInt(params.id)

    // Get mid-semester from quizzes table
    const [midSemester] = await sql`
      SELECT 
        q.*,
        au.username as created_by_username
      FROM quizzes q
      LEFT JOIN admin_users au ON q.created_by = au.id
      WHERE q.id = ${midSemesterId} AND q.assessment_type = 'mid_semester'
    `

    if (!midSemester) {
      return NextResponse.json({ error: "Mid-semester not found" }, { status: 404 })
    }

    // Get questions from quiz_questions table
    const questions = await sql`
      SELECT 
        id,
        quiz_id,
        question_text,
        question_order,
        option_a,
        option_b,
        option_c,
        option_d,
        option_e,
        TRIM(correct_answer) as correct_answer,
        bank_question_id,
        time_limit,
        question_type,
        created_at,
        sample_answers
      FROM quiz_questions
      WHERE quiz_id = ${midSemesterId}
      ORDER BY question_order ASC
    `

    // Get session access from quiz_session_access table
    const sessionAccess = await sql`
      SELECT session_code, is_active
      FROM quiz_session_access
      WHERE quiz_id = ${midSemesterId}
    `

    const session_access = sessionAccess.reduce((acc: Record<string, boolean>, row: any) => {
      acc[row.session_code] = row.is_active
      return acc
    }, {})

    return NextResponse.json({
      exam: { ...midSemester, session_access },
      questions,
    })
  } catch (error) {
    console.error("[v0] Failed to fetch mid-semester:", error)
    return NextResponse.json({ error: "Failed to fetch mid-semester" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const midSemesterId = Number.parseInt(params.id)

    await sql`
      DELETE FROM quizzes
      WHERE id = ${midSemesterId} AND assessment_type = 'mid_semester'
    `

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Failed to delete mid-semester:", error)
    return NextResponse.json({ error: "Failed to delete mid-semester" }, { status: 500 })
  }
}
