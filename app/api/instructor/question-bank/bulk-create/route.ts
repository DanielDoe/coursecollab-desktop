import { type NextRequest, NextResponse } from "next/server"
import { requireInstructorQuestionBankScope } from "@/lib/instructor-question-bank-scope"
import {
  bulkCreateQuestionBankQuestions,
  QUESTION_BANK_BULK_MAX,
} from "@/lib/cora/services/bulk-create-questions"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const scope = await requireInstructorQuestionBankScope(request)
    if (!scope.ok) return scope.response

    const body = await request.json()
    const rawQuestions = Array.isArray(body?.questions) ? body.questions : []
    if (rawQuestions.length === 0) {
      return NextResponse.json({ error: "No questions to save" }, { status: 400 })
    }
    if (rawQuestions.length > QUESTION_BANK_BULK_MAX) {
      return NextResponse.json(
        { error: `Max ${QUESTION_BANK_BULK_MAX} questions per batch` },
        { status: 400 },
      )
    }

    const result = await bulkCreateQuestionBankQuestions({
      instructorId: scope.instructorId,
      courseId: scope.course.id,
      questions: rawQuestions,
    })

    return NextResponse.json({
      success: true,
      createdCount: result.createdCount,
      questionIds: result.questionIds,
    })
  } catch (error) {
    console.error("[question-bank bulk-create]", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save questions" },
      { status: 500 },
    )
  }
}
