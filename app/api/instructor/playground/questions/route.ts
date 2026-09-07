import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import { buildInstructorOwnedCourseScopeSqlFragment } from "@/lib/instructor-default-courses"
import {
  filterPlaygroundQuestionTypes,
  PLAYGROUND_ALLOWED_QUESTION_TYPES,
} from "@/lib/playground-question-utils"



export const dynamic = "force-dynamic"

/**
 * GET - Fetch questions from question bank filtered by type (MCQ and True/False only)
 * Used for playground question selection
 */
export async function GET(request: NextRequest) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response
    const qbScope = buildInstructorOwnedCourseScopeSqlFragment(
      "question_bank",
      "course_id",
      scope.course.id,
      scope.instructorId,
    )

    const { searchParams } = new URL(request.url)
    const topic = searchParams.get("topic")
    const difficulty = searchParams.get("difficulty")
    const search = searchParams.get("search")
    const questionTypes = searchParams.get("questionTypes") // Comma-separated list

    const questionTypesArray = questionTypes
      ? filterPlaygroundQuestionTypes(questionTypes.split(","))
      : [...PLAYGROUND_ALLOWED_QUESTION_TYPES]

    // Build query with explicit conditions to avoid SQL syntax errors
    let questions
    if (topic && difficulty && search) {
      questions = await sql`
        SELECT 
          id,
          question_text,
          question_type,
          difficulty,
          topic,
          options,
          correct_answer,
          hint,
          created_at
        FROM question_bank
        WHERE question_type = ANY(${questionTypesArray})
        AND deleted_at IS NULL
        AND (${qbScope})
        AND topic = ${topic}
        AND difficulty = ${difficulty}
        AND question_text ILIKE ${`%${search}%`}
        ORDER BY topic, difficulty, created_at DESC
      `
    } else if (topic && difficulty) {
      questions = await sql`
        SELECT 
          id,
          question_text,
          question_type,
          difficulty,
          topic,
          options,
          correct_answer,
          hint,
          created_at
        FROM question_bank
        WHERE question_type = ANY(${questionTypesArray})
        AND deleted_at IS NULL
        AND (${qbScope})
        AND topic = ${topic}
        AND difficulty = ${difficulty}
        ORDER BY topic, difficulty, created_at DESC
      `
    } else if (topic && search) {
      questions = await sql`
        SELECT 
          id,
          question_text,
          question_type,
          difficulty,
          topic,
          options,
          correct_answer,
          hint,
          created_at
        FROM question_bank
        WHERE question_type = ANY(${questionTypesArray})
        AND deleted_at IS NULL
        AND (${qbScope})
        AND topic = ${topic}
        AND question_text ILIKE ${`%${search}%`}
        ORDER BY topic, difficulty, created_at DESC
      `
    } else if (difficulty && search) {
      questions = await sql`
        SELECT 
          id,
          question_text,
          question_type,
          difficulty,
          topic,
          options,
          correct_answer,
          hint,
          created_at
        FROM question_bank
        WHERE question_type = ANY(${questionTypesArray})
        AND deleted_at IS NULL
        AND (${qbScope})
        AND difficulty = ${difficulty}
        AND question_text ILIKE ${`%${search}%`}
        ORDER BY topic, difficulty, created_at DESC
      `
    } else if (topic) {
      questions = await sql`
        SELECT 
          id,
          question_text,
          question_type,
          difficulty,
          topic,
          options,
          correct_answer,
          hint,
          created_at
        FROM question_bank
        WHERE question_type = ANY(${questionTypesArray})
        AND deleted_at IS NULL
        AND (${qbScope})
        AND topic = ${topic}
        ORDER BY topic, difficulty, created_at DESC
      `
    } else if (difficulty) {
      questions = await sql`
        SELECT 
          id,
          question_text,
          question_type,
          difficulty,
          topic,
          options,
          correct_answer,
          hint,
          created_at
        FROM question_bank
        WHERE question_type = ANY(${questionTypesArray})
        AND deleted_at IS NULL
        AND (${qbScope})
        AND difficulty = ${difficulty}
        ORDER BY topic, difficulty, created_at DESC
      `
    } else if (search) {
      questions = await sql`
        SELECT 
          id,
          question_text,
          question_type,
          difficulty,
          topic,
          options,
          correct_answer,
          hint,
          created_at
        FROM question_bank
        WHERE question_type = ANY(${questionTypesArray})
        AND deleted_at IS NULL
        AND (${qbScope})
        AND question_text ILIKE ${`%${search}%`}
        ORDER BY topic, difficulty, created_at DESC
      `
    } else {
      questions = await sql`
        SELECT 
          id,
          question_text,
          question_type,
          difficulty,
          topic,
          options,
          correct_answer,
          hint,
          created_at
        FROM question_bank
        WHERE question_type = ANY(${questionTypesArray})
        AND deleted_at IS NULL
        AND (${qbScope})
        ORDER BY topic, difficulty, created_at DESC
      `
    }

    // Format questions for display
    const formattedQuestions = questions.map((q: any) => {
      const options = q.options || []
      const correctAnswer = q.correct_answer

      return {
        id: q.id,
        questionText: q.question_text,
        questionType: q.question_type,
        difficulty: q.difficulty,
        topic: q.topic,
        options: Array.isArray(options) ? options : [],
        correctAnswer: correctAnswer,
        hint: q.hint,
        optionCount: Array.isArray(options) ? options.length : 0,
      }
    })

    // Get unique topics for filter dropdown (based on filtered questions)
    const topics = await sql`
      SELECT DISTINCT topic
      FROM question_bank
      WHERE question_type = ANY(${questionTypesArray})
      AND topic IS NOT NULL
      AND deleted_at IS NULL
      AND (${qbScope})
      ORDER BY topic
    `

    const availableTypes = await sql`
      SELECT DISTINCT question_type
      FROM question_bank
      WHERE deleted_at IS NULL
      AND question_type = ANY(${[...PLAYGROUND_ALLOWED_QUESTION_TYPES]})
      AND (${qbScope})
      ORDER BY question_type
    `

    return NextResponse.json({
      questions: formattedQuestions,
      topics: topics.map((t) => t.topic),
      questionTypes: availableTypes.map((t) => t.question_type),
      totalCount: formattedQuestions.length,
    })
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch questions" }, { status: 500 })
  }
}

