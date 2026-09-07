import { type NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { sql } from "@/lib/db"
import { normalizeQuestionBankRowForStorage } from "@/lib/question-type-schema"



// GET - List all questions with filters
export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function GET(request: NextRequest) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get("type")
    const difficulty = searchParams.get("difficulty")
    const topic = searchParams.get("topic")
    const search = searchParams.get("search")

    const whereConditions = []
    if (type) whereConditions.push(`question_type = '${type.replace(/'/g, "''")}'`)
    if (difficulty) whereConditions.push(`difficulty = '${difficulty.replace(/'/g, "''")}'`)
    if (topic) whereConditions.push(`topic = '${topic.replace(/'/g, "''")}'`)
    if (search) whereConditions.push(`question_text ILIKE '%${search.replace(/'/g, "''")}%'`)

    const whereClause = whereConditions.length > 0 ? `AND ${whereConditions.join(" AND ")}` : ""

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
        updated_at,
        (
          SELECT COUNT(DISTINCT qbu.quiz_id)
          FROM question_bank_usage qbu
          WHERE qbu.bank_question_id = id
        ) as quiz_usage_count
      FROM question_bank
      WHERE deleted_at IS NULL ${sql.unsafe(whereClause)}
      ORDER BY created_at DESC
    `

    const parsedQuestions = questions.map((q: any) => {
      // JSONB fields from PostgreSQL are already JavaScript objects/arrays
      const options = q.options || []
      const correctAnswer = q.correct_answer
      const answerGuidelines = q.answer_guidelines || []

      return {
        ...q,
        options,
        correct_answer: correctAnswer,
        answer_guidelines: answerGuidelines,
        option_count: Array.isArray(options) ? options.length : 0,
      }
    })

    // Get unique topics for filter dropdown (only from active questions)
    const topics = await sql`
      SELECT DISTINCT topic
      FROM question_bank
      WHERE topic IS NOT NULL
      AND deleted_at IS NULL
      ORDER BY topic
    `

    return NextResponse.json({
      questions: parsedQuestions,
      topics: topics.map((t) => t.topic),
    })
  } catch (error) {
    console.error("[v0] Failed to fetch question bank:", error)
    return NextResponse.json({ error: "Failed to fetch question bank" }, { status: 500 })
  }
}

// POST - Create new question
export async function POST(request: NextRequest) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
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

    if (!question_text || !question_type) {
      return NextResponse.json({ error: "Question text and type are required" }, { status: 400 })
    }

    const validTypes = [
      "true_false",
      "mcq",
      "select_all",
      "fill_blank",
      "code_output",
      "code_debug",
      "fill_code",
      "trace_logic",
      "scenario_match",
      "multi_output",
      "code_reorder",
      "code_problem",
      "trace_output",
      "debug_code",
      "code_write",
      "code_explain",
    ]
    if (!validTypes.includes(question_type)) {
      return NextResponse.json({ error: "Invalid question type" }, { status: 400 })
    }

    const normalized = normalizeQuestionBankRowForStorage({
      question_type,
      options,
      correct_answer,
    })

    const questionResult = await sql`
      INSERT INTO question_bank (
        question_text,
        question_type,
        difficulty,
        topic,
        options,
        correct_answer,
        hint,
        evaluation_mode,
        sample_answer,
        answer_guidelines,
        explanation
      )
      VALUES (
        ${question_text},
        ${question_type},
        ${difficulty || "medium"},
        ${topic || null},
        ${JSON.stringify(normalized.options)},
        ${JSON.stringify(normalized.correct_answer ?? "")},
        ${hint || null},
        ${evaluation_mode || "auto"},
        ${sample_answer || null},
        ${JSON.stringify(answer_guidelines || [])},
        ${explanation || null}
      )
      RETURNING id
    `

    const questionId = questionResult[0].id

    return NextResponse.json({ questionId, success: true })
  } catch (error) {
    console.error("[v0] Failed to create question:", error)
    return NextResponse.json({ error: "Failed to create question" }, { status: 500 })
  }
}

// DELETE - Bulk soft delete questions
export async function DELETE(request: NextRequest) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const { ids } = await request.json()

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "Question IDs are required" }, { status: 400 })
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

    // Soft delete by setting deleted_at timestamp for all selected questions
    await sql`
      UPDATE question_bank
      SET deleted_at = NOW(), deleted_by = ${deletedBy}
      WHERE id = ANY(${ids})
    `

    return NextResponse.json({ 
      success: true, 
      deleted: ids.length,
      message: `${ids.length} question(s) moved to trash successfully`
    })
  } catch (error) {
    console.error("[v0] Failed to delete questions:", error)
    return NextResponse.json({ error: "Failed to delete questions" }, { status: 500 })
  }
}
