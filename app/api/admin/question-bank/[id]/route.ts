import { type NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { sql } from "@/lib/db"
import { normalizeQuestionBankRowForStorage } from "@/lib/question-type-schema"



// GET - Get single question with options
export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const questionId = Number.parseInt(params.id)

    if (Number.isNaN(questionId)) {
      return NextResponse.json({ error: "Invalid question ID" }, { status: 400 })
    }

    const questions = await sql`
      SELECT 
        id,
        question_text,
        question_type,
        difficulty,
        topic,
        options,
        correct_answer,
        hint,
        evaluation_mode,
        answer_guidelines,
        sample_answer,
        explanation,
        created_at,
        updated_at
      FROM question_bank
      WHERE id = ${questionId}
    `

    if (questions.length === 0) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 })
    }

    return NextResponse.json({
      question: questions[0],
    })
  } catch (error) {
    console.error("[v0] Failed to fetch question:", error)
    return NextResponse.json({ error: "Failed to fetch question" }, { status: 500 })
  }
}

// PUT - Update question
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const questionId = Number.parseInt(params.id)

    if (Number.isNaN(questionId)) {
      return NextResponse.json({ error: "Invalid question ID" }, { status: 400 })
    }

    const {
      question_text,
      question_type,
      difficulty,
      topic,
      hint,
      options,
      correct_answer,
      evaluation_mode,
      sample_answer,
      answer_guidelines,
      explanation,
    } = await request.json()

    const normalized = normalizeQuestionBankRowForStorage({
      question_type,
      options,
      correct_answer,
    })

    await sql`
      UPDATE question_bank
      SET 
        question_text = ${question_text},
        question_type = ${question_type},
        difficulty = ${difficulty || "medium"},
        topic = ${topic || null},
        hint = ${hint || null},
        options = ${JSON.stringify(normalized.options)},
        correct_answer = ${JSON.stringify(normalized.correct_answer ?? "")},
        evaluation_mode = ${evaluation_mode || "auto"},
        sample_answer = ${sample_answer || null},
        answer_guidelines = ${JSON.stringify(answer_guidelines || [])},
        explanation = ${explanation || null},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${questionId}
    `

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Failed to update question:", error)
    return NextResponse.json({ error: "Failed to update question" }, { status: 500 })
  }
}

// DELETE - Soft delete single question
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const questionId = Number.parseInt(params.id)

    if (Number.isNaN(questionId)) {
      return NextResponse.json({ error: "Invalid question ID" }, { status: 400 })
    }

    // Get admin info for deleted_by
    const adminSession = request.headers.get('admin-session')
    let deletedBy = 'admin'
    if (adminSession) {
      try {
        const adminInfo = await sql`
          SELECT username FROM admin_users WHERE session = ${adminSession}
        `
        if (adminInfo.length > 0) {
          deletedBy = adminInfo[0].username
        }
      } catch (error) {
        console.log("Could not get admin username:", error)
      }
    }

    // Soft delete by setting deleted_at timestamp
    await sql`
      UPDATE question_bank
      SET deleted_at = NOW(), deleted_by = ${deletedBy}
      WHERE id = ${questionId}
    `

    return NextResponse.json({ 
      success: true,
      message: "Question moved to trash successfully"
    })
  } catch (error) {
    console.error("[v0] Failed to delete question:", error)
    return NextResponse.json({ error: "Failed to delete question" }, { status: 500 })
  }
}
