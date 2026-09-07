import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireInstructorQuestionBankScope } from "@/lib/instructor-question-bank-scope"
import { questionMediaToJsonString } from "@/lib/question-media"
import { propagateBankQuestionMediaToQuizQuestions } from "@/lib/question-media-persist"
import { solutionUploadConfigToJsonString } from "@/lib/solution-upload"
import { normalizeQuestionBankRowForStorage } from "@/lib/question-type-schema"



// GET - Get single question with options
export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const scope = await requireInstructorQuestionBankScope(request)
    if (!scope.ok) return scope.response
    const { qbScope } = scope

    const { id } = await params
    const questionId = Number.parseInt(id)

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
        question_media,
        subquestions,
        solution_upload_config,
        expected_answer,
        created_at,
        updated_at
      FROM question_bank
      WHERE id = ${questionId}
        AND (${qbScope})
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
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const scope = await requireInstructorQuestionBankScope(request)
    if (!scope.ok) return scope.response
    const { qbScope } = scope

    const { id } = await params
    const questionId = Number.parseInt(id)

    if (Number.isNaN(questionId)) {
      return NextResponse.json({ error: "Invalid question ID" }, { status: 400 })
    }

    const body = await request.json()
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
      question_media,
      subquestions,
      solution_upload_config,
      expected_answer,
    } = body

    const mediaJson = questionMediaToJsonString(question_media)
    const solutionJson = solutionUploadConfigToJsonString(solution_upload_config)
    const normalized = normalizeQuestionBankRowForStorage({
      question_type: question_type ?? "mcq",
      options,
      correct_answer,
    })
    const hasSubquestionsField = Object.prototype.hasOwnProperty.call(body, "subquestions")
    const subquestionsJson =
      hasSubquestionsField && subquestions != null ? JSON.stringify(subquestions) : null
    const correctAnswerJson =
      normalized.correct_answer == null ? null : JSON.stringify(normalized.correct_answer)

    if (hasSubquestionsField) {
      await sql`
        UPDATE question_bank
        SET 
          question_text = ${question_text},
          question_type = ${question_type},
          difficulty = ${difficulty || "medium"},
          topic = ${topic || null},
          hint = ${hint || null},
          options = ${JSON.stringify(normalized.options)},
          correct_answer = ${correctAnswerJson}::jsonb,
          evaluation_mode = ${evaluation_mode || "auto"},
          sample_answer = ${sample_answer || null},
          answer_guidelines = ${JSON.stringify(answer_guidelines || [])},
          explanation = ${explanation || null},
          question_media = ${mediaJson === null ? null : mediaJson}::jsonb,
          subquestions = ${subquestionsJson}::jsonb,
          solution_upload_config = ${solutionJson === null ? null : solutionJson}::jsonb,
          expected_answer = ${expected_answer ?? null},
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ${questionId}
          AND (${qbScope})
      `
    } else {
      await sql`
        UPDATE question_bank
        SET 
          question_text = ${question_text},
          question_type = ${question_type},
          difficulty = ${difficulty || "medium"},
          topic = ${topic || null},
          hint = ${hint || null},
          options = ${JSON.stringify(normalized.options)},
          correct_answer = ${correctAnswerJson}::jsonb,
          evaluation_mode = ${evaluation_mode || "auto"},
          sample_answer = ${sample_answer || null},
          answer_guidelines = ${JSON.stringify(answer_guidelines || [])},
          explanation = ${explanation || null},
          question_media = ${mediaJson === null ? null : mediaJson}::jsonb,
          solution_upload_config = ${solutionJson === null ? null : solutionJson}::jsonb,
          expected_answer = ${expected_answer ?? null},
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ${questionId}
          AND (${qbScope})
      `
    }

    if (mediaJson) {
      await propagateBankQuestionMediaToQuizQuestions(questionId, mediaJson)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Failed to update question:", error)
    return NextResponse.json({ error: "Failed to update question" }, { status: 500 })
  }
}

// DELETE - Soft delete single question
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const scope = await requireInstructorQuestionBankScope(request)
    if (!scope.ok) return scope.response
    const { qbScope } = scope

    const { id } = await params
    const questionId = Number.parseInt(id)

    if (Number.isNaN(questionId)) {
      return NextResponse.json({ error: "Invalid question ID" }, { status: 400 })
    }

    // Get instructor info for deleted_by
    const instructorSession = request.headers.get('instructor-session')
    let deletedBy = 'instructor'
    if (instructorSession) {
      try {
        const instructorInfo = await sql`
          SELECT username FROM instructor_users WHERE session = ${instructorSession}
        `
        if (instructorInfo.length > 0) {
          deletedBy = instructorInfo[0].username
        }
      } catch (error) {
        console.log("Could not get instructor username:", error)
      }
    }

    // Soft delete by setting deleted_at timestamp
    const updateResult = await sql`
      UPDATE question_bank
      SET deleted_at = NOW(), deleted_by = ${deletedBy}
      WHERE id = ${questionId}
        AND (${qbScope})
      RETURNING id
    `

    if (updateResult.length === 0) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 })
    }

    return NextResponse.json({ 
      success: true,
      message: "Question moved to trash successfully"
    })
  } catch (error) {
    console.error("[v0] Failed to delete question:", error)
    return NextResponse.json({ error: "Failed to delete question" }, { status: 500 })
  }
}

