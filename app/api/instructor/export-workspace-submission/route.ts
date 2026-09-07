import { type NextRequest, NextResponse } from "next/server"
import { ensureQuizAnswerIdForAttemptQuestion } from "@/lib/ensure-quiz-answer-row"
import { requireInstructorGradingAccess } from "@/lib/instructor-grading-auth"
import {
  exportWorkspaceSubmissionForAnswer,
  exportWorkspaceSubmissionsForAttempt,
} from "@/lib/export-workspace-submission-for-answer"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 120

export async function POST(request: NextRequest) {
  try {
    const instructorSession = request.headers.get("authorization") || request.headers.get("x-instructor-id")
    const adminId = request.headers.get("x-admin-id")
    if (!instructorSession && !adminId) {
      return NextResponse.json({ error: "Instructor or admin authentication required" }, { status: 401 })
    }

    const body = await request.json()
    const {
      answerId: answerIdRaw,
      attemptId: attemptIdRaw,
      questionId: questionIdRaw,
      allForAttempt = false,
      reGrade = true,
    } = body

    const instructorId =
      request.headers.get("x-instructor-id") ||
      request.headers.get("authorization") ||
      (adminId ? `admin:${adminId}` : "instructor")

    const gradingAuth = await requireInstructorGradingAccess(request, {
      answerId: answerIdRaw != null ? Number(answerIdRaw) : undefined,
      attemptId: attemptIdRaw != null ? Number(attemptIdRaw) : undefined,
    })
    if (!gradingAuth.ok) return gradingAuth.response

    if (allForAttempt && attemptIdRaw != null) {
      const attemptId = Number(attemptIdRaw)
      if (!Number.isFinite(attemptId) || attemptId <= 0) {
        return NextResponse.json({ error: "Invalid attemptId" }, { status: 400 })
      }
      const batch = await exportWorkspaceSubmissionsForAttempt({
        attemptId,
        reGrade: reGrade !== false,
        instructorId,
      })
      return NextResponse.json({
        success: true,
        ...batch,
        message:
          batch.processed.length > 0
            ? `Exported workspace for ${batch.processed.length} question(s).`
            : batch.failed.length > 0
              ? "Export failed for all targeted questions."
              : "No workspace submissions needed export for this attempt.",
      })
    }

    let answerId: number
    if (answerIdRaw != null && answerIdRaw !== "") {
      answerId = Number(answerIdRaw)
      if (!Number.isFinite(answerId) || answerId <= 0) {
        return NextResponse.json({ error: "Invalid answerId" }, { status: 400 })
      }
    } else if (attemptIdRaw != null && questionIdRaw != null) {
      const attemptId = Number(attemptIdRaw)
      const questionId = Number(questionIdRaw)
      if (!Number.isFinite(attemptId) || attemptId <= 0 || !Number.isFinite(questionId) || questionId <= 0) {
        return NextResponse.json({ error: "Invalid attemptId or questionId" }, { status: 400 })
      }
      try {
        answerId = await ensureQuizAnswerIdForAttemptQuestion(attemptId, questionId)
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Could not resolve answer row"
        return NextResponse.json({ error: msg }, { status: 400 })
      }
    } else {
      return NextResponse.json(
        { error: "Provide answerId, or attemptId + questionId, or attemptId with allForAttempt" },
        { status: 400 },
      )
    }

    const result = await exportWorkspaceSubmissionForAnswer({
      answerId,
      reGrade: reGrade !== false,
      instructorId,
    })

    return NextResponse.json({ success: true, ...result })
  } catch (error: unknown) {
    console.error("[export-workspace-submission]", error)
    const message = error instanceof Error ? error.message : "Export failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
