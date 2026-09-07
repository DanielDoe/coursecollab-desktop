import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { sqlRows } from "@/lib/sql-rows"
import {
  compactCircuitSubmissionForSubmit,
  parseCircuitSubmissionAnswer,
} from "@/lib/circuit-submission"
import { ensureQuizAnswerIdForAttemptQuestion } from "@/lib/ensure-quiz-answer-row"
import { requireInstructorGradingAccess } from "@/lib/instructor-grading-auth"
import { parseMultiPartStudentAnswer, parseSubquestions } from "@/lib/multi-part-question"

export const dynamic = "force-dynamic"

const SUPPORTED_TYPES = new Set(["circuit_submission", "multi_part", "code_write_plot"])

function parseExistingAnswerData(raw: unknown): Record<string, unknown> {
  if (!raw) return {}
  if (typeof raw === "object") return raw as Record<string, unknown>
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as Record<string, unknown>
    } catch {
      return {}
    }
  }
  return {}
}

/**
 * POST /api/instructor/submit-answer-on-behalf
 * Faculty recovery: persist student answers when submit failed (circuit, multi-part, code+plot).
 */
export async function POST(request: NextRequest) {
  try {
    const instructorSession = request.headers.get("authorization") || request.headers.get("x-instructor-id")
    const adminId = request.headers.get("x-admin-id")

    if (!instructorSession && !adminId) {
      return NextResponse.json({ error: "Instructor or admin authentication required" }, { status: 401 })
    }

    const body = await request.json()
    const {
      attemptId: attemptIdRaw,
      questionId: questionIdRaw,
      questionType,
      answer,
      plotImage,
      reason,
    } = body

    const attemptId = typeof attemptIdRaw === "string" ? parseInt(attemptIdRaw, 10) : Number(attemptIdRaw)
    const questionId = typeof questionIdRaw === "string" ? parseInt(questionIdRaw, 10) : Number(questionIdRaw)
    const qt = (questionType || "").toLowerCase()

    if (!Number.isFinite(attemptId) || attemptId <= 0 || !Number.isFinite(questionId) || questionId <= 0) {
      return NextResponse.json({ error: "Valid attemptId and questionId required" }, { status: 400 })
    }
    if (!SUPPORTED_TYPES.has(qt)) {
      return NextResponse.json(
        { error: "Only circuit_submission, multi_part, and code_write_plot are supported" },
        { status: 400 },
      )
    }
    if (answer === undefined || answer === null) {
      return NextResponse.json({ error: "answer is required" }, { status: 400 })
    }

    const gradingAuth = await requireInstructorGradingAccess(request, { attemptId })
    if (!gradingAuth.ok) return gradingAuth.response

    const answerId = await ensureQuizAnswerIdForAttemptQuestion(attemptId, questionId)

    const existingRows = sqlRows(
      await sql`
      SELECT selected_answer, answer_data
      FROM quiz_answers
      WHERE id = ${answerId}
      LIMIT 1
    `,
    )
    const existing = existingRows[0] as { selected_answer: string | null; answer_data: unknown } | undefined
    const existingData = parseExistingAnswerData(existing?.answer_data)

    const audit: Record<string, unknown> = {
      submitted_on_behalf_by: gradingAuth.instructorLabel,
      submitted_on_behalf_at: new Date().toISOString(),
    }
    if (typeof reason === "string" && reason.trim()) {
      audit.submitted_on_behalf_reason = reason.trim()
    }

    let selectedAnswer: string
    let answerData: Record<string, unknown>

    if (qt === "circuit_submission") {
      const incoming = parseCircuitSubmissionAnswer(answer)
      const existingParsed = parseCircuitSubmissionAnswer(existing?.selected_answer ?? existing?.answer_data)
      const merged = {
        ...incoming,
        submission_status: "submitted" as const,
        manual_score: existingParsed.manual_score,
        rubric_scores: existingParsed.rubric_scores,
        instructor_feedback: existingParsed.instructor_feedback,
        graded_at: existingParsed.graded_at,
        graded_by: existingParsed.graded_by,
      }
      selectedAnswer = compactCircuitSubmissionForSubmit(merged)
      answerData = {
        questionType: "circuit_submission",
        ...audit,
        solution_uploads: merged.solution_uploads,
        submission_status: merged.submission_status,
        submission_mode: merged.submission_mode ?? "upload",
      }
      if (existingData.multi_part_grading) {
        answerData.multi_part_grading = existingData.multi_part_grading
      }
    } else if (qt === "multi_part") {
      const qRows = sqlRows(
        await sql`
        SELECT subquestions FROM quiz_questions WHERE id = ${questionId} LIMIT 1
      `,
      )
      const subquestions = parseSubquestions((qRows[0] as { subquestions?: unknown } | undefined)?.subquestions)
      const answerStr = typeof answer === "string" ? answer : JSON.stringify(answer)
      const parsed = parseMultiPartStudentAnswer(answerStr, subquestions)
      selectedAnswer = JSON.stringify(parsed)
      answerData = {
        questionType: "multi_part",
        ...audit,
        parts: parsed.parts,
      }
      if (parsed.solution_uploads && Object.keys(parsed.solution_uploads).length > 0) {
        answerData.solution_uploads = parsed.solution_uploads
      }
      if (existingData.multi_part_grading) {
        answerData.multi_part_grading = existingData.multi_part_grading
      }
    } else {
      const code =
        typeof answer === "string"
          ? answer
          : typeof answer === "object" && answer && "code" in answer
            ? String((answer as { code?: unknown }).code ?? "")
            : String(answer)
      const plot =
        plotImage ??
        (typeof answer === "object" && answer && "plotImage" in answer
          ? (answer as { plotImage?: string }).plotImage
          : undefined)

      selectedAnswer = code
      answerData = {
        questionType: "code_write_plot",
        code,
        ...audit,
      }
      if (plot) answerData.plotImage = plot
    }

    await sql`
      UPDATE quiz_answers
      SET
        selected_answer = ${selectedAnswer},
        answer_data = ${JSON.stringify(answerData)}::jsonb,
        answered_at = NOW(),
        requires_review = true,
        points_earned = COALESCE(points_earned, 0),
        is_correct = COALESCE(is_correct, false)
      WHERE id = ${answerId}
    `

    return NextResponse.json({
      success: true,
      answerId,
      message: "Answer saved on behalf of student. Use Re-evaluate to run grading.",
    })
  } catch (e) {
    console.error("[instructor/submit-answer-on-behalf]", e)
    const msg = e instanceof Error ? e.message : "Failed to save answer"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
