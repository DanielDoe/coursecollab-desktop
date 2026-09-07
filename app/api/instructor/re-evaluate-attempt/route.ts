import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { bulkReevaluateAttemptCore } from "@/lib/bulk-reevaluate-attempt-core"
import { requireInstructorGradingAccess } from "@/lib/instructor-grading-auth"
import { requireCallerStudentDbId } from "@/lib/student-api-auth"
import { getBaseUrl } from "@/lib/get-base-url"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 90 // One answer per request; keep under Vercel timeout

/**
 * Bulk re-evaluate all questions in an attempt.
 * Options: all | failed | stuck
 *
 * CRITICAL - NEVER: delete quiz_answers, update selected_answer/answer_data, or update question_id.
 * Only updates: is_correct, points_earned, ai_feedback, requires_review, reviewed_by, reviewed_at, answered_at.
 */
export async function POST(request: NextRequest) {
  try {
    const reqId = Date.now().toString(36)
    const slimResponse = request.headers.get("x-bulk-reevaluate") === "1"
    if (!slimResponse) {
      console.warn(`\n========== [Bulk Re-evaluate] REQUEST ${reqId} ==========`)
    }

    const hasFacultyClaim = !!(
      request.headers.get("authorization") ||
      request.headers.get("x-instructor-id") ||
      request.headers.get("x-admin-id")
    )
    const studentCaller = hasFacultyClaim ? null : await requireCallerStudentDbId(request)
    const isStudentRequest = studentCaller?.ok === true

    if (!hasFacultyClaim && !isStudentRequest) {
      return studentCaller && !studentCaller.ok
        ? studentCaller.response
        : NextResponse.json({ error: "Instructor, admin, or student authentication required" }, { status: 401 })
    }

    const { attemptId, mode = "failed", answerIds: clientAnswerIds, index: clientIndex } = await request.json()

    if (!attemptId) {
      return NextResponse.json({ error: "Attempt ID is required" }, { status: 400 })
    }

    if (!isStudentRequest) {
      const gradingAuth = await requireInstructorGradingAccess(request, { attemptId: Number(attemptId) })
      if (!gradingAuth.ok) return gradingAuth.response
    }

    /** First HTTP call in a chunked run: client sends only `{ attemptId, mode }` (no answerIds). */
    const isChunkedRunStart = !Array.isArray(clientAnswerIds) || clientAnswerIds.length === 0

    if (!slimResponse) {
      console.log(`[Bulk Re-evaluate ${reqId}] attemptId=${attemptId} mode=${mode} isStudent=${isStudentRequest}`)
    }

    let instructorId = "instructor"

    if (!["all", "failed", "stuck"].includes(mode)) {
      return NextResponse.json({ error: "Invalid mode. Must be 'all', 'failed', or 'stuck'" }, { status: 400 })
    }

    if (!slimResponse) {
      console.log("[Instructor Bulk Re-evaluate] Re-evaluating attempt:", attemptId, "mode:", mode)
    }

    const attemptData = await sql`
      SELECT 
        qa.id as attempt_id,
        qa.quiz_id,
        qa.student_id,
        qa.score as current_score,
        qa.total_questions,
        qa.student_bulk_re_evaluate_used_at
      FROM quiz_attempts qa
      WHERE qa.id = ${attemptId}
    `
    const [quizModeRow] = attemptData.length > 0
      ? await sql`
          SELECT 
            COALESCE(
              NULLIF(TRIM(ai_evaluation_mode), ''),
              CASE
                WHEN LOWER(COALESCE(assessment_type, '')) IN ('homework', 'quiz') THEN 'relaxed'
                WHEN LOWER(COALESCE(assessment_type, '')) IN ('mid_semester', 'mid-semester') THEN 'strict'
                WHEN LOWER(COALESCE(assessment_type, '')) IN ('final', 'finals') THEN 'very_strict'
                ELSE 'standard'
              END
            ) as ai_evaluation_mode,
            COALESCE(NULLIF(TRIM(code_language), ''), 'cpp') as code_language
          FROM quizzes WHERE id = ${(attemptData[0] as any).quiz_id}
        `
      : []
    const evaluationMode = (quizModeRow as any)?.ai_evaluation_mode || "standard"
    const codeLanguage = (quizModeRow as any)?.code_language || "cpp"
    if (!slimResponse) {
      console.log(
        `[Instructor Bulk Re-evaluate] Using AI mode: ${evaluationMode}, code language: ${codeLanguage} (from quiz EditQuizForm config)`
      )
    }

    if (slimResponse && isChunkedRunStart) {
      console.warn(
        `\n========== [Bulk Re-evaluate/slim] ATTEMPT START attemptId=${attemptId} mode=${mode} isStudent=${isStudentRequest} req=${reqId} ==========`
      )
      console.log(
        `[Bulk Re-evaluate/slim] Using AI mode: ${evaluationMode}, code language: ${codeLanguage} (from quiz config)` +
          ` — chunked re-eval (one question per request); follow progress below until COMPLETE.`
      )
    }

    if (attemptData.length === 0) {
      return NextResponse.json({ error: "Attempt not found" }, { status: 404 })
    }

    const attempt = attemptData[0] as any

    if (isStudentRequest) {
      const studentDatabaseId = studentCaller!.studentDbId
      if (attempt.student_id !== studentDatabaseId) {
        return NextResponse.json({ error: "Access denied. This attempt does not belong to you." }, { status: 403 })
      }
      const hasBulkUsed = (attempt as any).student_bulk_re_evaluate_used_at != null
      if (hasBulkUsed) {
        return NextResponse.json(
          {
            error:
              "You've already used Re-evaluate All for this attempt. Contact your instructor if you need further help.",
          },
          { status: 400 }
        )
      }
      instructorId = "student:self"

      const instructorOverrideRows = await sql`
        SELECT 1 AS x
        FROM quiz_answers
        WHERE attempt_id = ${attemptId}
          AND override_points IS NOT NULL
        LIMIT 1
      `
      if (instructorOverrideRows.length > 0) {
        return NextResponse.json(
          {
            error:
              "Your instructor has adjusted one or more grades on this submission. Re-evaluate All is disabled so those grades stay final. Contact your instructor if something looks wrong.",
          },
          { status: 403 }
        )
      }
    }

    const requestOrigin = getBaseUrl(request.nextUrl?.origin)

    const result = await bulkReevaluateAttemptCore({
      attemptId,
      mode,
      instructorId,
      evaluationMode,
      codeLanguage,
      processAllAnswersInOneRun: false,
      clientAnswerIds,
      clientIndex,
      requestOrigin,
      isStudentRequest,
      studentIdHeader: isStudentRequest ? String(studentCaller!.studentDbId) : null,
      slimResponse,
    })

    if ("error" in result && result.error) {
      return NextResponse.json({ error: result.error }, { status: 404 })
    }

    if (slimResponse && result && typeof result === "object" && "attemptId" in result) {
      const r = result as {
        attemptId: number
        answerIds?: number[]
        nextIndex?: number
        done?: boolean
        evaluated?: number
        failed?: number
        skipped?: number
        newAttemptScore?: number
        totalAnswers?: number
        message?: string
      }
      const total = Array.isArray(r.answerIds) ? r.answerIds.length : 0
      const next = typeof r.nextIndex === "number" ? r.nextIndex : "?"
      const progress =
        total > 0 ? `chunk progress=${next}/${total} (nextIndex=${next}, total=${total})` : "chunk (single or no list)"
      console.log(
        `[Bulk Re-evaluate/slim] attemptId=${r.attemptId} req=${reqId} ${progress} done=${r.done} ` +
          `thisStep: evaluated=${r.evaluated} failed=${r.failed} skipped=${r.skipped}`
      )
      if (r.done === true) {
        console.warn(
          `========== [Bulk Re-evaluate/slim] ATTEMPT COMPLETE attemptId=${r.attemptId} req=${reqId} ` +
            `newScore=${r.newAttemptScore ?? "?"} totalAnswers=${r.totalAnswers ?? "?"} ` +
            `evaluated=${r.evaluated ?? "?"} failed=${r.failed ?? "?"} skipped=${r.skipped ?? "?"} ==========\n`
        )
        if (r.message) {
          console.log(`[Bulk Re-evaluate/slim] ${r.message}`)
        }
      }
    }

    return NextResponse.json(result)
  } catch (error: any) {
    console.error("[Instructor Bulk Re-evaluate] Error:", error)
    return NextResponse.json(
      {
        error: "Failed to bulk re-evaluate attempt",
        details: error.message,
      },
      { status: 500 }
    )
  }
}
