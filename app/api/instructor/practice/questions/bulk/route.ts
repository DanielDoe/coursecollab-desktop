import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireInstructorPracticeBankMutation } from "@/lib/instructor-practice-scope"
import { buildInstructorOwnedCourseScopeSqlFragment } from "@/lib/instructor-default-courses"
import { bulkUpsertPracticeQuestionAvailability } from "@/lib/practice-question-availability"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const gate = await requireInstructorPracticeBankMutation(request)
    if (!gate.ok) return gate.response

    const { topic, session, questionIds, isAvailable } = await request.json()
    const sess = String(session ?? "ALL").trim() || "ALL"
    const ids = Array.isArray(questionIds)
      ? questionIds.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0)
      : []

    if (!topic?.trim()) {
      return NextResponse.json({ error: "Topic is required" }, { status: 400 })
    }
    if (ids.length === 0) {
      return NextResponse.json({ error: "questionIds array is required" }, { status: 400 })
    }

    const qbScope = buildInstructorOwnedCourseScopeSqlFragment(
      "question_bank",
      "course_id",
      gate.course.id,
      gate.instructorId,
      { scopeCourseCode: gate.course.course_code },
    )

    const owned = await sql`
      SELECT id
      FROM question_bank
      WHERE deleted_at IS NULL
        AND topic = ${String(topic).trim()}
        AND id = ANY(${ids})
        AND (${qbScope})
    `
    const ownedIds = owned.map((row) => Number(row.id))
    if (ownedIds.length === 0) {
      return NextResponse.json({ error: "No matching questions found" }, { status: 404 })
    }

    await bulkUpsertPracticeQuestionAvailability({
      questionIds: ownedIds,
      session: sess,
      isAvailable: Boolean(isAvailable),
      updatedBy: gate.instructorId,
    })

    return NextResponse.json({
      success: true,
      updated: ownedIds.length,
      session: sess,
      isAvailable: Boolean(isAvailable),
    })
  } catch (error) {
    console.error("Error bulk updating practice question availability:", error)
    return NextResponse.json({ error: "Failed to update questions" }, { status: 500 })
  }
}
