import { type NextRequest, NextResponse } from "next/server"
import { requireSummerCampStaff } from "@/lib/summer-camp/permissions"
import { isFacultyAssignedToTraining } from "@/lib/summer-camp/permissions"
import { createFeedbackCard } from "@/lib/summer-camp/showcase"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const scope = await requireSummerCampStaff(request)
    if (!scope.ok) return scope.response

    const body = await request.json()
    const trainingId = Number(body.training_id)
    const studentId = Number(body.student_id)

    if (!Number.isFinite(trainingId) || !Number.isFinite(studentId) || !body.title || !body.message) {
      return NextResponse.json({ error: "training_id, student_id, title, message required" }, { status: 400 })
    }

    const assigned = await isFacultyAssignedToTraining(scope.instructorId, trainingId)
    if (!assigned) {
      return NextResponse.json({ error: "Not assigned" }, { status: 403 })
    }

    const card = await createFeedbackCard({
      studentId,
      trainingId,
      instructorId: scope.instructorId,
      submissionId: body.submission_id ? Number(body.submission_id) : undefined,
      cardType: body.card_type ?? "general",
      title: String(body.title),
      strengths: body.strengths,
      improvements: body.improvements,
      rubricScores: body.rubric_scores,
      message: String(body.message),
    })

    return NextResponse.json({ card })
  } catch (error) {
    console.error("[instructor/summer-camp/feedback-cards POST]", error)
    return NextResponse.json({ error: "Failed to create feedback card" }, { status: 500 })
  }
}
