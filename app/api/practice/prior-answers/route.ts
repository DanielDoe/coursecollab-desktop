import { type NextRequest, NextResponse } from "next/server"
import { requireStudentPracticeCaller } from "@/lib/require-student-practice-auth"
import { loadLatestPracticeAnswersForQuestionIds } from "@/lib/practice-prior-attempts"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const auth = await requireStudentPracticeCaller(
      request,
      searchParams.get("studentId"),
      searchParams.get("session"),
      searchParams.get("courseId"),
    )
    if (!auth.ok) return auth.response

    const rawIds = searchParams.get("questionIds") ?? searchParams.get("ids") ?? ""
    const questionIds = rawIds
      .split(",")
      .map((value) => Number(value.trim()))
      .filter((id) => Number.isFinite(id) && id > 0)

    const priors = await loadLatestPracticeAnswersForQuestionIds(auth.studentDbId, questionIds)
    return NextResponse.json({
      answers: priors.map((row) => ({
        questionId: row.questionId,
        alreadyAttempted: true,
        priorAnswer: row.studentAnswer,
        priorIsCorrect: row.isCorrect,
        answerReview: row.answerReview,
      })),
    })
  } catch (error) {
    console.error("[practice/prior-answers]", error)
    return NextResponse.json({ error: "Failed to load prior practice answers" }, { status: 500 })
  }
}
