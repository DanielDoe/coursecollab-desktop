import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { runBulkReevaluateAttemptAssessmentTabBatch } from "@/lib/bulk-reevaluate-attempt-batch-run"
import { requireInstructorGradingAccess } from "@/lib/instructor-grading-auth"
import { requireCallerStudentDbId } from "@/lib/student-api-auth"
import { getBaseUrl } from "@/lib/get-base-url"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
/** Entire attempt in one handler: batched AI + optional plot fallbacks */
export const maxDuration = 300

/**
 * POST /api/instructor/re-evaluate-attempt-batch
 * One HTTP request grades an entire attempt (batched AI for code text; code_write_plot uses vision per plot question).
 * - Instructors: Assessment re-evaluate tab + optional student “Re-evaluate all” (cost-efficient).
 * - Students: `x-student-id` — same rules as chunked route (one-time per attempt, no instructor overrides).
 * For question-by-question grading use POST /api/instructor/re-evaluate-attempt (chunked).
 */
export async function POST(request: NextRequest) {
  try {
    const reqId = Date.now().toString(36)
    const slimResponse = request.headers.get("x-bulk-reevaluate") === "1"

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

    const { attemptId, mode = "all" } = await request.json()

    if (!attemptId) {
      return NextResponse.json({ error: "Attempt ID is required" }, { status: 400 })
    }

    if (!isStudentRequest) {
      const gradingAuth = await requireInstructorGradingAccess(request, { attemptId: Number(attemptId) })
      if (!gradingAuth.ok) return gradingAuth.response
    }

    if (!["all", "failed", "stuck"].includes(mode)) {
      return NextResponse.json({ error: "Invalid mode. Must be 'all', 'failed', or 'stuck'" }, { status: 400 })
    }

    let instructorId = "instructor"

    const attemptData = await sql`
      SELECT qa.quiz_id, qa.student_id, qa.student_bulk_re_evaluate_used_at
      FROM quiz_attempts qa
      WHERE qa.id = ${attemptId}
    `
    if (attemptData.length === 0) {
      return NextResponse.json({ error: "Attempt not found" }, { status: 404 })
    }

    const attemptRow = attemptData[0] as {
      quiz_id: number
      student_id: number
      student_bulk_re_evaluate_used_at: unknown
    }

    let studentDatabaseId: number | null = null
    if (isStudentRequest) {
      const sid = studentCaller!.studentDbId
      if (attemptRow.student_id !== sid) {
        return NextResponse.json({ error: "Access denied. This attempt does not belong to you." }, { status: 403 })
      }
      if (attemptRow.student_bulk_re_evaluate_used_at != null) {
        return NextResponse.json(
          {
            error:
              "You've already used Re-evaluate All for this attempt. Contact your instructor if you need further help.",
          },
          { status: 400 }
        )
      }
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
              "Your instructor has adjusted one or more grades on this submission. Re-evaluate All is disabled so those grades stay final.",
          },
          { status: 403 }
        )
      }
      instructorId = "student:self"
      studentDatabaseId = sid
    }

    const [quizModeRow] = await sql`
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
      FROM quizzes WHERE id = ${attemptRow.quiz_id}
    `
    const evaluationMode = (quizModeRow as { ai_evaluation_mode?: string })?.ai_evaluation_mode || "standard"
    const codeLanguage = (quizModeRow as { code_language?: string })?.code_language || "cpp"

    console.warn(
      `\n========== [Bulk Re-evaluate/batch] ATTEMPT START attemptId=${attemptId} mode=${mode} req=${reqId} ==========`
    )
    console.log(
      `[Bulk Re-evaluate/batch] One HTTP request grades the full attempt (Assessment tab). ` +
        `AI mode=${evaluationMode} codeLanguage=${codeLanguage} slimResponse=${slimResponse}`
    )

    const requestOrigin = getBaseUrl(request.nextUrl?.origin)

    const t0 = Date.now()
    const result = await runBulkReevaluateAttemptAssessmentTabBatch({
      attemptId,
      mode: mode as "all" | "failed" | "stuck",
      instructorId,
      evaluationMode,
      codeLanguage,
      requestOrigin,
      slimResponse,
      isStudentRequest,
      studentDatabaseId,
    })
    const ms = Date.now() - t0

    if ("error" in result && result.error) {
      console.warn(
        `[Bulk Re-evaluate/batch] attemptId=${attemptId} mode=${mode} req=${reqId} FAILED ${ms}ms — ${result.error}`
      )
      return NextResponse.json({ error: result.error }, { status: 404 })
    }

    const r = result as {
      evaluated?: number
      updated?: number
      failed?: number
      skipped?: number
      newAttemptScore?: number
      message?: string
    }
    console.warn(
      `========== [Bulk Re-evaluate/batch] ATTEMPT COMPLETE attemptId=${attemptId} mode=${mode} req=${reqId} ` +
        `${ms}ms newScore=${r.newAttemptScore ?? "?"} evaluated=${r.evaluated ?? "?"} updated=${r.updated ?? "?"} ` +
        `failed=${r.failed ?? "?"} skipped=${r.skipped ?? "?"} ==========\n`
    )
    if (r.message) {
      console.log(`[Bulk Re-evaluate/batch] ${r.message}`)
    }

    return NextResponse.json(result)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to batch re-evaluate attempt"
    console.error("[re-evaluate-attempt-batch]", error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
