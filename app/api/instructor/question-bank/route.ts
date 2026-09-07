import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { jsonWithPerf, withApiPerf } from "@/lib/perf/api"
import { requireInstructorQuestionBankScope } from "@/lib/instructor-question-bank-scope"
import { isAllowedQuestionTypeForCourse } from "@/lib/custom-question-types-server"
import { questionMediaToJsonString } from "@/lib/question-media"
import { solutionUploadConfigToJsonString } from "@/lib/solution-upload"
import { normalizeQuestionBankRowForStorage } from "@/lib/question-type-schema"



// GET - List all questions with filters
export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

async function getQuestionBank(request: NextRequest) {
  try {
    const scope = await requireInstructorQuestionBankScope(request)
    if (!scope.ok) return scope.response
    const { qbScope } = scope

    const { searchParams } = new URL(request.url)
    const type = searchParams.get("type")
    const difficulty = searchParams.get("difficulty")
    const topic = searchParams.get("topic")
    const search = searchParams.get("search")
    const listView = searchParams.get("view") === "list"

    // Build WHERE conditions with proper SQL escaping
    const whereConditions: string[] = []
    
    if (type) {
      whereConditions.push(`question_type = '${type.replace(/'/g, "''")}'`)
    }
    if (difficulty) {
      whereConditions.push(`difficulty = '${difficulty.replace(/'/g, "''")}'`)
    }
    if (topic) {
      whereConditions.push(`topic = '${topic.replace(/'/g, "''")}'`)
    }
    if (search) {
      whereConditions.push(`question_text ILIKE '%${search.replace(/'/g, "''")}%'`)
    }
    
    // Build the WHERE clause
    const whereClause = whereConditions.length > 0 ? ` AND ${whereConditions.join(" AND ")}` : ""

    // Use the same pattern as admin route - template literal with sql.unsafe for WHERE clause
    // This is the proven working pattern
    // Handle empty whereClause by conditionally including it
    const selectSql = listView
      ? `id, LEFT(question_text, 280) AS question_text, question_type, difficulty, topic,
         created_at, updated_at,
         CASE WHEN options IS NULL THEN 0 ELSE 1 END AS option_count,
         COALESCE(u.quiz_usage_count, 0) AS quiz_usage_count`
      : `id, question_text, question_type, difficulty, topic, options, correct_answer, hint,
         evaluation_mode, answer_guidelines, sample_answer, explanation, question_media,
         subquestions, created_at, updated_at, COALESCE(u.quiz_usage_count, 0) AS quiz_usage_count`
    const usageJoin = `LEFT JOIN (
      SELECT bank_question_id, COUNT(DISTINCT quiz_id)::int AS quiz_usage_count
      FROM question_bank_usage
      GROUP BY bank_question_id
    ) u ON u.bank_question_id = question_bank.id`

    const questions = whereClause
      ? await sql`
          SELECT ${sql.unsafe(selectSql)}
          FROM question_bank
          ${sql.unsafe(usageJoin)}
          WHERE deleted_at IS NULL
            AND (${qbScope})
            ${sql.unsafe(whereClause)}
          ORDER BY created_at DESC
        `
      : await sql`
          SELECT ${sql.unsafe(selectSql)}
          FROM question_bank
          ${sql.unsafe(usageJoin)}
          WHERE deleted_at IS NULL
            AND (${qbScope})
          ORDER BY created_at DESC
        `

    // Ensure questions is always an array
    const questionsArray = Array.isArray(questions) ? questions : []
    
    const parsedQuestions = questionsArray.map((q: any) => {
      // JSONB fields from PostgreSQL are already JavaScript objects/arrays
      const options = q.options || []
      const correctAnswer = q.correct_answer
      const answerGuidelines = q.answer_guidelines || []

      return {
        ...q,
        options: listView ? undefined : options,
        correct_answer: listView ? undefined : correctAnswer,
        answer_guidelines: listView ? undefined : answerGuidelines,
        option_count: listView
          ? Number(q.option_count ?? 0)
          : Array.isArray(options)
            ? options.length
            : 0,
        _partial: listView,
      }
    })

    // Get unique topics for filter dropdown (only from active questions)
    const topics = await sql`
      SELECT DISTINCT topic
      FROM question_bank
      WHERE topic IS NOT NULL
      AND deleted_at IS NULL
      AND (${qbScope})
      ORDER BY topic
    `

    return jsonWithPerf({
      questions: parsedQuestions,
      topics: topics.map((t) => t.topic),
    })
  } catch (error) {
    console.error("[v0] Failed to fetch question bank:", error)
    return NextResponse.json({ error: "Failed to fetch question bank" }, { status: 500 })
  }
}

export const GET = withApiPerf(getQuestionBank)

// POST - Create new question
export async function POST(request: NextRequest) {
  try {
    const scope = await requireInstructorQuestionBankScope(request)
    if (!scope.ok) return scope.response

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
    } = await request.json()

    if (!question_text || !question_type) {
      return NextResponse.json({ error: "Question text and type are required" }, { status: 400 })
    }

    const allowed = await isAllowedQuestionTypeForCourse(scope.course.id, question_type)
    if (!allowed) {
      return NextResponse.json({ error: "Invalid question type" }, { status: 400 })
    }

    const mediaJson = questionMediaToJsonString(question_media)
    const solutionJson = solutionUploadConfigToJsonString(solution_upload_config)
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
        explanation,
        course_id,
        question_media,
        subquestions,
        solution_upload_config,
        expected_answer
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
        ${explanation || null},
        ${scope.course.id},
        ${mediaJson === null ? null : mediaJson}::jsonb,
        ${subquestions == null ? null : JSON.stringify(subquestions)}::jsonb,
        ${solutionJson === null ? null : solutionJson}::jsonb,
        ${expected_answer || null}
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
  try {
    const scope = await requireInstructorQuestionBankScope(request)
    if (!scope.ok) return scope.response
    const { qbScope } = scope

    const { ids } = await request.json()

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "Question IDs are required" }, { status: 400 })
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

    // Soft delete by setting deleted_at timestamp for all selected questions
    await sql`
      UPDATE question_bank
      SET deleted_at = NOW(), deleted_by = ${deletedBy}
      WHERE id = ANY(${ids})
        AND (${qbScope})
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