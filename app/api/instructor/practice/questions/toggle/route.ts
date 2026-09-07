import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireInstructorPracticeBankMutation } from "@/lib/instructor-practice-scope"
import { buildInstructorOwnedCourseScopeSqlFragment } from "@/lib/instructor-default-courses"
import { upsertPracticeQuestionAvailability } from "@/lib/practice-question-availability"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const gate = await requireInstructorPracticeBankMutation(request)
    if (!gate.ok) return gate.response

    const { questionId, session, isAvailable } = await request.json()
    const qid = Number(questionId)
    const sess = String(session ?? "ALL").trim() || "ALL"

    if (!Number.isFinite(qid) || qid <= 0) {
      return NextResponse.json({ error: "Valid questionId is required" }, { status: 400 })
    }

    const qbScope = buildInstructorOwnedCourseScopeSqlFragment(
      "question_bank",
      "course_id",
      gate.course.id,
      gate.instructorId,
      { scopeCourseCode: gate.course.course_code },
    )

    const owned = await sql`
      SELECT id FROM question_bank
      WHERE id = ${qid}
        AND deleted_at IS NULL
        AND (${qbScope})
      LIMIT 1
    `
    if (owned.length === 0) {
      return NextResponse.json({ error: "Question not found in this course" }, { status: 404 })
    }

    await upsertPracticeQuestionAvailability({
      questionId: qid,
      session: sess,
      isAvailable: Boolean(isAvailable),
      updatedBy: gate.instructorId,
    })

    return NextResponse.json({
      success: true,
      questionId: qid,
      session: sess,
      isAvailable: Boolean(isAvailable),
    })
  } catch (error) {
    console.error("Error toggling practice question availability:", error)
    return NextResponse.json({ error: "Failed to update question availability" }, { status: 500 })
  }
}
