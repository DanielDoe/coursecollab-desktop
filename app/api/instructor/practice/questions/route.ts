import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import { buildInstructorOwnedCourseScopeSqlFragment } from "@/lib/instructor-default-courses"
import {
  ensurePracticeQuestionAvailabilityTable,
  resolvePracticeQuestionAvailability,
} from "@/lib/practice-question-availability"

export const dynamic = "force-dynamic"

function parseOptions(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String)
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed.map(String) : []
    } catch {
      return []
    }
  }
  return []
}

export async function GET(request: NextRequest) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response

    const { searchParams } = new URL(request.url)
    const topic = searchParams.get("topic")?.trim()
    const session = searchParams.get("session")?.trim() || "ALL"

    if (!topic) {
      return NextResponse.json({ error: "Topic is required" }, { status: 400 })
    }

    await ensurePracticeQuestionAvailabilityTable()

    const qbScope = buildInstructorOwnedCourseScopeSqlFragment(
      "question_bank",
      "course_id",
      scope.course.id,
      scope.instructorId,
      { scopeCourseCode: scope.course.course_code },
    )

    const rows = await sql`
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
      WHERE deleted_at IS NULL
        AND topic = ${topic}
        AND (${qbScope})
      ORDER BY id ASC
    `

    const questionIds = rows.map((row) => Number(row.id))
    const availability = await resolvePracticeQuestionAvailability(questionIds, session)

    const questions = rows.map((row) => {
      const options = parseOptions(row.options)
      const id = Number(row.id)
      return {
        id,
        questionText: String(row.question_text ?? ""),
        questionType: String(row.question_type ?? ""),
        difficulty: String(row.difficulty ?? "medium"),
        topic: String(row.topic ?? topic),
        options,
        optionCount: options.length,
        hint: row.hint ? String(row.hint) : null,
        isAvailable: availability.get(id) ?? true,
      }
    })

    const availableCount = questions.filter((q) => q.isAvailable).length

    return NextResponse.json({
      topic,
      session,
      questions,
      totalCount: questions.length,
      availableCount,
      hiddenCount: questions.length - availableCount,
    })
  } catch (error) {
    console.error("Error fetching practice topic questions:", error)
    return NextResponse.json({ error: "Failed to fetch practice questions" }, { status: 500 })
  }
}
