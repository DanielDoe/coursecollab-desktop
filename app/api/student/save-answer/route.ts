import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getAssessmentConfig, normalizeAssessmentType, type AssessmentType } from "@/lib/assessment-core/db"
import {
  compactCircuitSubmissionForAutoSave,
  mergeCircuitSubmissionForAutoSave,
  parseCircuitSubmissionAnswer,
} from "@/lib/circuit-submission"
import { getDocumentAtTime, type TypingReplay } from "@/lib/typing-replay"
import { isCodeAnswerCorrupt } from "@/lib/code-answer-validation"
import { isAnswerFinalized, isLockableQuizQuestionType } from "@/lib/quiz-answer-lock"
import { requireAttemptOwnership, requireCallerStudentDbId } from "@/lib/student-api-auth"
import { getAttemptStrictAnswerLockContext } from "@/lib/assessment-resume-integrity"

export const dynamic = 'force-dynamic'
export const runtime = "nodejs"

/**
 * POST /api/student/save-answer
 * 
 * Auto-save endpoint for persisting student answers immediately
 * This is a lightweight save that doesn't evaluate answers
 * Supports all assessment types via assessment_type detection
 */
export async function POST(request: NextRequest) {
  try {
    const caller = await requireCallerStudentDbId(request)
    if (!caller.ok) return caller.response

    // Handle empty or malformed request body
    let body
    try {
      const text = await request.text()
      if (!text || text.trim() === '') {
        return NextResponse.json(
          { error: "Empty request body" },
          { status: 400 }
        )
      }
      body = JSON.parse(text)
    } catch (parseError) {
      console.error("[Auto-Save] JSON parse error:", parseError)
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      )
    }
    
    const {
      attemptId,
      questionId,
      answer,
      questionType,
      autoSave = true,
      submissionFailed = false, // When true: flag for instructor to evaluate (timeout/network)
      clearSubmissionFailed = false, // When true: strip stale submissionFailed after successful retry
      submissionErrorType, // e.g. AbortError, TimeoutError - for instructor diagnostics
      submissionRetryCount, // Number of retries before fallback - for instructor diagnostics
      typingReplay, // For code questions: typing replay for anti-cheat
      timeSpentSeconds, // Seconds spent on this question (for results report)
    } = body

    // [TYPING-REPLAY-DEBUG] Log incoming typing replay for code questions
    const isCodeType = ["code_write", "code_problem", "debug_code", "code_explain", "code_write_plot", "code_debug"].includes((questionType || "").toLowerCase())
    if (isCodeType) {
      const hasReplay = !!typingReplay
      const eventCount = typingReplay?.events?.length ?? 0
      console.log("[save-answer] [TYPING-REPLAY] code question", {
        attemptId,
        questionId,
        questionType,
        hasReplay,
        eventCount,
        hasEventsArray: Array.isArray(typingReplay?.events),
      })
    }

    if (!attemptId || !questionId || answer === undefined) {
      return NextResponse.json(
        { error: "Missing required fields: attemptId, questionId, answer" },
        { status: 400 }
      )
    }

    const ownership = await requireAttemptOwnership(request, Number(attemptId))
    if (!ownership.ok) return ownership.response

    // Get attempt to determine assessment type
    // Note: quiz_attempts table doesn't have assessment_type column, only quizzes table has it
    const attemptResult = await sql`
      SELECT 
        a.id,
        a.saved_for_later_at,
        q.assessment_type as quiz_assessment_type
      FROM quiz_attempts a
      LEFT JOIN quizzes q ON a.quiz_id = q.id
      WHERE a.id = ${attemptId}
      LIMIT 1
    `

    if (attemptResult.length === 0) {
      return NextResponse.json(
        { error: "Attempt not found" },
        { status: 404 }
      )
    }

    const attempt = attemptResult[0]

    // Look up question's time_limit to cap time_spent (students cannot exceed per-question limit)
    let timeSpentValue = timeSpentSeconds != null && timeSpentSeconds >= 0 ? timeSpentSeconds : null
    const normalizedType = normalizeAssessmentType(attempt.quiz_assessment_type)
    if (timeSpentValue != null && normalizedType !== "homework") {
      const qLimitResult = await sql`
        SELECT time_limit FROM quiz_questions
        WHERE id = ${questionId} AND quiz_id = (SELECT quiz_id FROM quiz_attempts WHERE id = ${attemptId} LIMIT 1)
        LIMIT 1
      `
      const qLimit = qLimitResult[0]?.time_limit
      if (qLimit != null && Number(qLimit) > 0 && timeSpentValue > Number(qLimit)) {
        timeSpentValue = Number(qLimit)
      }
    }
    
    // Normalize assessment type using shared function
    // Handles: 'quiz', 'homework', 'mid_semester' -> 'midsem', 'final', 'finals' -> 'final', etc.
    const config = getAssessmentConfig(normalizedType)
    const answersTable = config.answersTable

    // Prepare answer value for storage
    // For multi-select, answer is already JSON stringified, for others it's a string
    const answerValue = typeof answer === 'string' ? answer : JSON.stringify(answer)
    const clientAutoSave = autoSave !== false && autoSave !== "false"
    const answerDataObj: Record<string, unknown> = {
      answer: typeof answer === 'string' ? answer : answer,
      questionType,
      autoSave: clientAutoSave,
      savedAt: new Date().toISOString(),
    }
    if (!clientAutoSave) {
      answerDataObj.finalizedAt = new Date().toISOString()
    }
    if (clearSubmissionFailed === true || clearSubmissionFailed === "true") {
      answerDataObj.submissionFailed = false
    } else {
      answerDataObj.submissionFailed = submissionFailed
      if (submissionFailed) {
        if (submissionErrorType) answerDataObj.submission_error_type = submissionErrorType
        if (submissionRetryCount != null) answerDataObj.submission_retry_count = submissionRetryCount
      }
    }
    if (typingReplay?.events?.length) {
      answerDataObj.typing_replay = typingReplay
      if (isCodeType) {
        console.log("[save-answer] [TYPING-REPLAY] storing", { attemptId, questionId, eventCount: typingReplay.events.length })
      }
    } else if (isCodeType) {
      console.log("[save-answer] [TYPING-REPLAY] NOT storing - no events", { attemptId, questionId })
    }
    
    // SELECT first to decide UPDATE vs INSERT (avoids ON CONFLICT which requires unique constraint)
    const existing = await sql`
      SELECT id, selected_answer, answer_data FROM ${sql.unsafe(config.answersTable)}
      WHERE attempt_id = ${attemptId} AND question_id = ${questionId}
      LIMIT 1
    `
    const requiresReview =
      clearSubmissionFailed === true || clearSubmissionFailed === "true"
        ? false
        : Boolean(submissionFailed)

    const { strict: strictAnswerLock } = await getAttemptStrictAnswerLockContext(
      Number(attemptId),
      request,
    )

    if (
      existing.length > 0 &&
      isAnswerFinalized(existing[0].answer_data, existing[0].selected_answer) &&
      (isLockableQuizQuestionType(questionType) || strictAnswerLock)
    ) {
      return NextResponse.json(
        { error: "Answer already submitted and locked", locked: true },
        { status: 409 },
      )
    }

    // CRITICAL: Preserve existing typing_replay if incoming payload doesn't have it (prevents overwriting with stale data)
    if (!typingReplay?.events?.length && existing.length > 0 && existing[0].answer_data) {
      try {
        const existingData = typeof existing[0].answer_data === "string"
          ? JSON.parse(existing[0].answer_data)
          : existing[0].answer_data
        if (existingData?.typing_replay?.events?.length) {
          answerDataObj.typing_replay = existingData.typing_replay
          if (isCodeType) {
            console.log("[save-answer] [TYPING-REPLAY] preserved existing", { attemptId, questionId, eventCount: existingData.typing_replay.events.length })
          }
        }
      } catch {
        /* ignore */
      }
    }

    // CRITICAL: Do NOT overwrite code with empty or corrupt - prevents data loss
    // (MCQ/select_all/true_false sent for code question, race condition, stale state)
    let finalAnswerValue = answerValue
    const incomingEmpty = answerValue == null || String(answerValue).trim() === ""
    const incomingCorrupt = isCodeType && answerValue && isCodeAnswerCorrupt(answerValue)
    if ((incomingEmpty || incomingCorrupt) && existing.length > 0 && isCodeType) {
      // Source 1: existing selected_answer
      let existingCode = existing[0].selected_answer != null && String(existing[0].selected_answer).trim() !== ""
        ? String(existing[0].selected_answer)
        : null
      // Source 2: existing answer_data.answer or answer_data.code
      if (!existingCode && existing[0].answer_data) {
        try {
          const ed = typeof existing[0].answer_data === "string" ? JSON.parse(existing[0].answer_data) : existing[0].answer_data
          const fromData = ed?.code ?? ed?.answer
          if (fromData != null && String(fromData).trim() !== "") {
            existingCode = typeof fromData === "string" ? fromData : JSON.stringify(fromData)
          }
        } catch { /* ignore */ }
      }
      // Source 3: derive from typing_replay when we have replay but no stored code (or stored is corrupt)
      const replayToUse = typingReplay?.events?.length ? typingReplay : (() => {
        try {
          const ed = typeof existing[0].answer_data === "string" ? JSON.parse(existing[0].answer_data) : existing[0].answer_data
          return ed?.typing_replay?.events?.length ? ed.typing_replay : null
        } catch { return null }
      })()
      if ((!existingCode || (existingCode && isCodeAnswerCorrupt(existingCode))) && replayToUse?.events?.length) {
        const lastT = Math.max(...replayToUse.events.map((e: { t: number }) => e.t), 0)
        const derived = getDocumentAtTime(replayToUse, lastT + 1000)
        if (derived?.trim() && derived.length > (existingCode?.length || 0)) {
          existingCode = derived
          console.log("[save-answer] [DATA-LOSS-PREVENTION] derived code from typing_replay and storing", { attemptId, questionId, length: derived.length })
        }
      }
      if (existingCode) {
        finalAnswerValue = existingCode
        answerDataObj.answer = existingCode
        if (answerDataObj.code === undefined) answerDataObj.code = existingCode
        console.log("[save-answer] [DATA-LOSS-PREVENTION] preserved/derived code - incoming was empty or corrupt", { attemptId, questionId })
      }
    }
    // For new row: if incoming empty or corrupt but we have typing_replay, derive and store (never lose code)
    if ((incomingEmpty || incomingCorrupt) && existing.length === 0 && isCodeType && typingReplay?.events?.length) {
      const lastT = Math.max(...typingReplay.events.map((e: { t: number }) => e.t), 0)
      const derived = getDocumentAtTime(typingReplay, lastT + 1000)
      if (derived?.trim()) {
        finalAnswerValue = derived
        answerDataObj.answer = derived
        console.log("[save-answer] [DATA-LOSS-PREVENTION] new row: derived code from typing_replay", { attemptId, questionId, length: derived.length })
      }
    }
    // For code questions, ensure answer_data.code is set (used by results/re-evaluation)
    if (isCodeType && finalAnswerValue && String(finalAnswerValue).trim()) {
      answerDataObj.code = typeof finalAnswerValue === 'string' ? finalAnswerValue : String(finalAnswerValue)
    }

    // Single source of truth: if typing_replay is present, stored code MUST match replay final document.
    // Prevents drift (e.g. client sent template in `answer` while replay captured real edits; race / stale React state).
    const trForCanonical = answerDataObj.typing_replay as TypingReplay | undefined
    if (isCodeType && trForCanonical?.events?.length) {
      const lastT = Math.max(...trForCanonical.events.map((e) => e.t), 0)
      const canonicalFromReplay = getDocumentAtTime(trForCanonical, lastT + 1000)
      if (canonicalFromReplay.trim()) {
        finalAnswerValue = canonicalFromReplay
        answerDataObj.answer = canonicalFromReplay
        answerDataObj.code = canonicalFromReplay
      }
    }

    // Re-stringify answer_data after any answerDataObj.answer update
    let answerDataValue = JSON.stringify(answerDataObj)

    const isCircuitSubmission = (questionType || "").toLowerCase() === "circuit_submission"
    if (isCircuitSubmission && autoSave) {
      const existingAnswerRaw =
        existing.length > 0 && existing[0].selected_answer != null
          ? String(existing[0].selected_answer)
          : null
      finalAnswerValue =
        existingAnswerRaw != null && existingAnswerRaw.trim() !== ""
          ? mergeCircuitSubmissionForAutoSave(finalAnswerValue, existingAnswerRaw)
          : compactCircuitSubmissionForAutoSave(finalAnswerValue)
      try {
        const parsedDraft = parseCircuitSubmissionAnswer(finalAnswerValue)
        answerDataObj.answer = parsedDraft
        delete answerDataObj.workspace_replay
        if (existing.length > 0 && existing[0].answer_data) {
          const existingData =
            typeof existing[0].answer_data === "string"
              ? JSON.parse(existing[0].answer_data)
              : existing[0].answer_data
          if (existingData?.workspace_replay?.events?.length) {
            answerDataObj.workspace_replay = existingData.workspace_replay
          }
        }
        answerDataValue = JSON.stringify(answerDataObj)
      } catch {
        /* keep original payload */
      }
    }

    // Upsert avoids duplicate-key races when concurrent auto-saves hit the same attempt/question.
    await sql`
      INSERT INTO ${sql.unsafe(config.answersTable)} (
        attempt_id, question_id, selected_answer, answer_data, answered_at,
        is_correct, points_earned, requires_review, time_spent_seconds
      )
      VALUES (
        ${attemptId}, ${questionId}, ${finalAnswerValue}, ${answerDataValue}::jsonb, NOW(),
        false, 0, ${requiresReview}, ${timeSpentValue}
      )
      ON CONFLICT (attempt_id, question_id) DO UPDATE SET
        selected_answer = EXCLUDED.selected_answer,
        answer_data = EXCLUDED.answer_data,
        answered_at = NOW(),
        requires_review = CASE WHEN ${requiresReview} THEN true ELSE ${sql.unsafe(`${answersTable}.requires_review`)} END,
        time_spent_seconds = COALESCE(EXCLUDED.time_spent_seconds, ${sql.unsafe(`${answersTable}.time_spent_seconds`)})
    `

    // Update quiz_attempts.last_saved_at for Save and Finish Later resume tracking
    try {
      await sql`
        UPDATE quiz_attempts
        SET last_saved_at = NOW()
        WHERE id = ${attemptId} AND completed_at IS NULL
      `
    } catch {
      /* ignore - column may not exist in older DBs */
    }

    return NextResponse.json({ 
      success: true,
      message: "Answer saved successfully"
    })
  } catch (error: any) {
    console.error("[Auto-Save] Error:", error)
    return NextResponse.json(
      { 
        success: false,
        error: error.message || "Failed to save answer"
      },
      { status: 500 }
    )
  }
}
