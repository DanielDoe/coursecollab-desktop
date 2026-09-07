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
 * GET - Fetch all unique topics from question bank
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
    const questionTypes = searchParams.get("questionTypes") // Comma-separated list

    const types = questionTypes
      ? filterPlaygroundQuestionTypes(questionTypes.split(","))
      : [...PLAYGROUND_ALLOWED_QUESTION_TYPES]

    const topics = await sql`
      SELECT 
        topic,
        COUNT(*) as question_count
      FROM question_bank
      WHERE question_type = ANY(${types})
      AND topic IS NOT NULL 
      AND topic != ''
      AND deleted_at IS NULL
      AND (${qbScope})
      GROUP BY topic
      ORDER BY topic ASC
    `

    return NextResponse.json({
      topics: topics.map((t) => ({
        name: t.topic,
        questionCount: Number(t.question_count),
      })),
    })
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch topics" }, { status: 500 })
  }
}

