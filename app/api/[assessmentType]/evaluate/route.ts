import { NextRequest, NextResponse } from "next/server"
import type { AssessmentType } from "@/lib/assessment-core/db"
import {
  AssessmentEvaluateHttpError,
  buildAssessmentCoreEvaluateResponse,
} from "@/lib/assessment-core/evaluate-http"
import { getLockableAnswerBlockReason } from "@/lib/quiz-answer-lock"

export const dynamic = 'force-dynamic'
export const runtime = "nodejs"
export const maxDuration = 180 // 3min for AI evaluation

/**
 * POST /api/[assessmentType]/evaluate
 *
 * Dynamic evaluation endpoint for all assessment types.
 * circuit_submission, multi_part, and related types use evaluateAssessmentAnswer (vision AI).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ assessmentType: string }> },
) {
  const { assessmentType } = await params
  try {
    const assessmentTypeParam = assessmentType as AssessmentType

    const validTypes: AssessmentType[] = ['quiz', 'homework', 'midsem', 'final', 'practice', 'points']
    if (!validTypes.includes(assessmentTypeParam)) {
      return NextResponse.json(
        { error: `Invalid assessment type: ${assessmentTypeParam}` },
        { status: 400 },
      )
    }

    const body = await request.json()
    const {
      questionId,
      answer,
      questionType,
      attemptId,
      plotImage,
      typingReplay,
    } = body

    if (!questionId || !attemptId || answer === undefined) {
      return NextResponse.json(
        { error: "Missing required fields: questionId, attemptId, answer" },
        { status: 400 },
      )
    }

    const lockReason = await getLockableAnswerBlockReason(
      Number(attemptId),
      Number(questionId),
      questionType,
      { incomingAnswer: answer },
    )
    if (lockReason) {
      return NextResponse.json({ error: lockReason, locked: true }, { status: 409 })
    }

    const payload = await buildAssessmentCoreEvaluateResponse({
      assessmentType: assessmentTypeParam,
      questionId: Number(questionId),
      answer,
      questionType,
      attemptId: Number(attemptId),
      plotImage,
      typingReplay,
    })

    return NextResponse.json(payload)
  } catch (error: unknown) {
    if (error instanceof AssessmentEvaluateHttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error(`[${assessmentType} Evaluate] Error:`, error)
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json(
      { error: "Failed to evaluate answer", details: message },
      { status: 500 },
    )
  }
}
