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
    const isSaved = searchParams.get("saved") === "true"

    const midSemesters = await sql`
      SELECT 
        ms.id,
        ms.title,
        ms.description,
        ms.time_per_question,
        ms.is_public,
        ms.available_from,
        ms.available_until,
        ms.retake_enabled,
        ms.retake_limit,
        ms.retake_policy,
        ms.is_saved,
        ms.created_at,
        ms.updated_at,
        au.username as created_by_username,
        COUNT(msq.id) as total_questions
      FROM mid_semesters ms
      LEFT JOIN admin_users au ON ms.created_by = au.id
      LEFT JOIN mid_semester_questions msq ON ms.id = msq.mid_semester_id
      WHERE ms.is_saved = ${isSaved}
      GROUP BY ms.id, au.username
      ORDER BY ms.created_at DESC
    `

    return NextResponse.json(midSemesters)
  } catch (error) {
    console.error("[v0] Failed to fetch mid-semesters:", error)
    return NextResponse.json({ error: "Failed to fetch mid-semester exams" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const body = await request.json()
    const {
      title,
      description,
      createdBy,
      timePerQuestion,
      availableFrom,
      availableUntil,
      retakeEnabled,
      retakeLimit,
      retakePolicy,
      reviewBeforeRetake,
      isSaved,
      questions,
    } = body

    const retakeEnabledDb = retakeEnabled !== false

    // Create mid-semester
    const [midSemester] = await sql`
      INSERT INTO mid_semesters (
        title, description, created_by, time_per_question,
        available_from, available_until, retake_enabled, retake_limit,
        retake_policy, review_before_retake, is_saved
      )
      VALUES (
        ${title}, ${description}, ${createdBy}, ${timePerQuestion || 60},
        ${availableFrom || null}, ${availableUntil || null}, ${retakeEnabledDb},
        ${retakeLimit || null}, ${retakePolicy || "latest"}, ${reviewBeforeRetake || false},
        ${isSaved || false}
      )
      RETURNING *
    `

    // Insert questions
    if (questions && questions.length > 0) {
      for (const question of questions) {
        await sql`
          INSERT INTO mid_semester_questions (
            mid_semester_id, question_text, question_type, option_a, option_b,
            option_c, option_d, option_e, correct_answer, question_order,
            time_limit, points, hint, hint_penalty, bank_question_id
          )
          VALUES (
            ${midSemester.id}, ${question.question_text}, ${question.question_type},
            ${question.option_a}, ${question.option_b}, ${question.option_c},
            ${question.option_d}, ${question.option_e || null}, ${question.correct_answer},
            ${question.question_order}, ${question.time_limit || timePerQuestion},
            ${question.points || 1}, ${question.hint || null}, ${question.hint_penalty || 0.5},
            ${question.bank_question_id || null}
          )
        `
      }
    }

    return NextResponse.json(midSemester)
  } catch (error) {
    console.error("[v0] Failed to create mid-semester:", error)
    return NextResponse.json({ error: "Failed to create mid-semester exam" }, { status: 500 })
  }
}
