import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireInstructorQuestionBankScope } from "@/lib/instructor-question-bank-scope"



// GET - List all soft-deleted questions
export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function GET(request: NextRequest) {
  try {
    const scope = await requireInstructorQuestionBankScope(request)
    if (!scope.ok) return scope.response
    const { qbScope } = scope

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
        deleted_at,
        deleted_by,
        (
          SELECT COUNT(DISTINCT qbu.quiz_id)
          FROM question_bank_usage qbu
          WHERE qbu.bank_question_id = id
        ) as quiz_usage_count
      FROM question_bank
      WHERE deleted_at IS NOT NULL
        AND (${qbScope})
      ORDER BY deleted_at DESC
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

    // Get unique topics from deleted questions
    const topics = await sql`
      SELECT DISTINCT topic
      FROM question_bank
      WHERE topic IS NOT NULL
      AND deleted_at IS NOT NULL
      AND (${qbScope})
      ORDER BY topic
    `

    return NextResponse.json({
      questions: parsedQuestions,
      topics: topics.map((t) => t.topic),
    })
  } catch (error) {
    console.error("[v0] Failed to fetch deleted questions:", error)
    return NextResponse.json({ error: "Failed to fetch deleted questions" }, { status: 500 })
  }
}

// PATCH - Restore soft-deleted questions
export async function PATCH(request: NextRequest) {
  try {
    const scope = await requireInstructorQuestionBankScope(request)
    if (!scope.ok) return scope.response
    const { qbScope } = scope

    const { ids } = await request.json()

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "Question IDs are required" }, { status: 400 })
    }

    // Restore questions by setting deleted_at to NULL
    await sql`
      UPDATE question_bank
      SET deleted_at = NULL, deleted_by = NULL
      WHERE id = ANY(${ids})
        AND (${qbScope})
    `

    return NextResponse.json({ 
      success: true, 
      restored: ids.length,
      message: `${ids.length} question(s) restored successfully`
    })
  } catch (error) {
    console.error("[v0] Failed to restore questions:", error)
    return NextResponse.json({ error: "Failed to restore questions" }, { status: 500 })
  }
}

// DELETE - Permanently delete questions
export async function DELETE(request: NextRequest) {
  try {
    const scope = await requireInstructorQuestionBankScope(request)
    if (!scope.ok) return scope.response
    const { qbScope } = scope

    const { ids } = await request.json()

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "Question IDs are required" }, { status: 400 })
    }

    // Scope fragment qualifies `question_bank.*` — do not alias that table here.
    const usageCheck = await sql`
      SELECT COUNT(*) as count
      FROM question_bank_usage qbu
      INNER JOIN question_bank ON question_bank.id = qbu.bank_question_id
      WHERE qbu.bank_question_id = ANY(${ids})
        AND (${qbScope})
    `

    if (usageCheck[0].count > 0) {
      return NextResponse.json({ 
        error: "Cannot permanently delete questions that are still being used in quizzes" 
      }, { status: 400 })
    }

    // Permanently delete questions
    await sql`
      DELETE FROM question_bank
      WHERE id = ANY(${ids})
        AND (${qbScope})
    `

    return NextResponse.json({ 
      success: true, 
      deleted: ids.length,
      message: `${ids.length} question(s) permanently deleted`
    })
  } catch (error) {
    console.error("[v0] Failed to permanently delete questions:", error)
    return NextResponse.json({ error: "Failed to permanently delete questions" }, { status: 500 })
  }
}
