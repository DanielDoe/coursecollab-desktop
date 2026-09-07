import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getResumeGraceMinutes, isWithinResumeGrace } from "@/lib/quiz-resume-utils"
import { hasSaveAndFinishLaterAccess } from "@/lib/retake-access"
import { normalizeSuperpowerListFromUnknown } from "@/lib/superpowers-json"
import { ensureSectionTimerSchema } from "@/lib/ensure-section-timer-schema"
import { ensureSectionQuestionSelectionSchema } from "@/lib/ensure-section-question-selection-schema"
import { parseSectionQuestionSelections } from "@/lib/section-pick-scoring"
import { parseAssessmentSectionConfig } from "@/lib/assessment-sections"
import { sanitizeAttemptTimerState } from "@/lib/sanitize-attempt-timer-state"
import { getExamSharedTimerSeconds, EXAM_SHARED_TIMER_SECTION_KEY, usesSectionCountdown } from "@/lib/assessment-timer"
import { ensureUtcDate } from "@/lib/timezone"
import {
  CIRCUIT_ANSWER_FINALIZED_SQL,
  LOCKABLE_ANSWER_FINALIZED_SQL,
} from "@/lib/quiz-answer-data-sql"
import { requireStudentIdParamMatchesCaller } from "@/lib/student-api-auth"

export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await ensureSectionTimerSchema()
    await ensureSectionQuestionSelectionSchema()
    const { id: quizId } = await params

    const { searchParams } = new URL(request.url)
    const studentId = searchParams.get("studentId")
    const attemptIdParam = searchParams.get("attemptId")

    console.log("[quiz-attempt API] GET", { quizId, studentId, attemptIdParam })

    if (!studentId) {
      return NextResponse.json({ error: "Missing studentId" }, { status: 400 })
    }

    const auth = await requireStudentIdParamMatchesCaller(request, studentId)
    if (!auth.ok) return auth.response
    const studentDatabaseId = auth.studentDbId

    // Get attempt: use specific attemptId if provided (resume flow), else latest for this quiz
    // Include saved_for_later_at and remaining_time for Save and Finish Later
    let attempts
    const attemptIdNum = attemptIdParam ? parseInt(String(attemptIdParam), 10) : NaN
    if (attemptIdParam && !isNaN(attemptIdNum)) {
      attempts = await sql`
        SELECT id, attempt_number, completed_at, started_at, question_time_remaining, section_time_remaining, section_question_selections, current_question_index, saved_for_later_at, remaining_time, superpowers, COALESCE(violation_log, '[]'::jsonb) as violation_log
        FROM quiz_attempts
        WHERE id = ${attemptIdNum} AND student_id = ${studentDatabaseId} AND quiz_id = ${quizId}
          AND deleted_at IS NULL
        LIMIT 1
      `
    } else {
      attempts = await sql`
        SELECT id, attempt_number, completed_at, started_at, question_time_remaining, section_time_remaining, section_question_selections, current_question_index, saved_for_later_at, remaining_time, superpowers, COALESCE(violation_log, '[]'::jsonb) as violation_log
        FROM quiz_attempts
        WHERE student_id = ${studentDatabaseId} AND quiz_id = ${quizId}
          AND deleted_at IS NULL
        ORDER BY attempt_number DESC
        LIMIT 1
      `
    }

    if (attempts.length === 0) {
      const hasSaveLater = await hasSaveAndFinishLaterAccess(studentDatabaseId)
      return NextResponse.json({
        attemptId: null,
        flaggedQuestionIds: [],
        usedHintQuestionIds: [],
        hasSaveAndFinishLaterAccess: hasSaveLater,
      })
    }

    const attempt = attempts[0]
    const completedAt = attempt.completed_at

    // If incomplete, check resume grace period
    // EXCEPTION: Explorer/Trailblazer with saved_for_later_at can resume until quiz.available_until (or 7 days if no deadline)
    if (!completedAt) {
      const hasSaveLater = await hasSaveAndFinishLaterAccess(studentDatabaseId)
      const savedForLaterAt = attempt.saved_for_later_at

      if (hasSaveLater && savedForLaterAt) {
        // Save and Finish Later: allow resume until quiz deadline or 7 days
        const quizMeta = await sql`
          SELECT available_until FROM quizzes WHERE id = ${quizId} LIMIT 1
        `
        const availableUntil = quizMeta[0]?.available_until
        const cutoff = availableUntil
          ? new Date(availableUntil)
          : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        if (new Date() > cutoff) {
          return NextResponse.json({
            attemptId: null,
            sessionExpired: true,
            flaggedQuestionIds: [],
            usedHintQuestionIds: [],
            hasSaveAndFinishLaterAccess: true,
          })
        }
        // Within window - allow resume
      } else {
        // Standard grace period (quiz duration + buffer, max 24h)
        const quizMeta = await sql`
          SELECT COALESCE(q.time_per_question, 60)::int as time_per_question,
            (SELECT COUNT(*)::int FROM quiz_questions qq WHERE qq.quiz_id = q.id) as num_questions,
            q.available_until
          FROM quizzes q WHERE q.id = ${quizId}
        `
        const tp = Number(quizMeta[0]?.time_per_question || 60)
        const nq = Number(quizMeta[0]?.num_questions || 1)
        const graceMinutes = getResumeGraceMinutes(tp, nq)
        const startedAt = attempt.started_at instanceof Date ? attempt.started_at : new Date(attempt.started_at)
        if (!isWithinResumeGrace(startedAt, graceMinutes, quizMeta[0]?.available_until)) {
          const hasSaveLaterAccess = await hasSaveAndFinishLaterAccess(studentDatabaseId)
          return NextResponse.json({
            attemptId: null,
            sessionExpired: true,
            flaggedQuestionIds: [],
            usedHintQuestionIds: [],
            hasSaveAndFinishLaterAccess: hasSaveLaterAccess,
          })
        }
      }
    }
    const attemptId = attempt.id
    const rawQuestionTimeRemaining = attempt.question_time_remaining as
      | Record<string | number, number>
      | null
      | undefined
    const rawSectionTimeRemaining = (attempt as { section_time_remaining?: unknown })
      .section_time_remaining as Record<string | number, number> | null | undefined

    const quizQuestions = await sql`
      SELECT id, question_type, question_order
      FROM quiz_questions
      WHERE quiz_id = ${quizId}
      ORDER BY question_order ASC
    `
    const quizMeta = await sql`
      SELECT section_config, assessment_type FROM quizzes WHERE id = ${quizId} LIMIT 1
    `
    const sectionConfig = parseAssessmentSectionConfig(quizMeta[0]?.section_config)
    const assessmentType = quizMeta[0]?.assessment_type as string | null | undefined
    const questions = quizQuestions.map((q) => ({
      id: Number(q.id),
      question_type: q.question_type as string | null,
      question_order: q.question_order as number | null,
    }))
    const savedForLaterAt = attempt.saved_for_later_at
    const { questionTimeRemaining, sectionTimeRemaining } = sanitizeAttemptTimerState(
      questions,
      sectionConfig,
      rawQuestionTimeRemaining,
      rawSectionTimeRemaining,
      { fillMissingToFull: !savedForLaterAt },
      assessmentType,
    )

    let sectionTimeRemainingOut = sectionTimeRemaining
    if (
      savedForLaterAt &&
      Object.keys(sectionTimeRemainingOut).length === 0
    ) {
      const examShared = getExamSharedTimerSeconds(sectionConfig)
      if (examShared != null && attempt.started_at) {
        const started = ensureUtcDate(attempt.started_at as string | Date)
        const elapsed = Math.floor((Date.now() - started.getTime()) / 1000)
        const remaining = Math.max(0, examShared - elapsed)
        sectionTimeRemainingOut = { [String(EXAM_SHARED_TIMER_SECTION_KEY)]: remaining }
        sectionConfig?.forEach((cfg, idx) => {
          if (cfg && usesSectionCountdown(cfg, assessmentType)) {
            sectionTimeRemainingOut[String(idx)] = remaining
          }
        })
      }
    }

    // Auto-repair stale circuit per-question keys / missing section pool on resume fetch
    if (!completedAt) {
      const rawQ = JSON.stringify(rawQuestionTimeRemaining ?? {})
      const rawS = JSON.stringify(rawSectionTimeRemaining ?? {})
      const cleanQ = JSON.stringify(questionTimeRemaining)
      const cleanS = JSON.stringify(sectionTimeRemainingOut)
      if (rawQ !== cleanQ || rawS !== cleanS) {
        await sql`
          UPDATE quiz_attempts
          SET
            question_time_remaining = ${cleanQ}::jsonb,
            section_time_remaining = ${cleanS}::jsonb
          WHERE id = ${attemptId} AND completed_at IS NULL
        `
      }
    }
    const sectionQuestionSelections = parseSectionQuestionSelections(
      (attempt as { section_question_selections?: unknown }).section_question_selections,
    )
    const currentQuestionIndex =
      typeof attempt.current_question_index === "number"
        ? attempt.current_question_index
        : 0
    const remainingTime = attempt.remaining_time ?? null

    // Get hasSaveAndFinishLaterAccess for UI (Explorer/Trailblazer only)
    const hasSaveLater = await hasSaveAndFinishLaterAccess(studentDatabaseId)

    // Get flagged questions for this attempt
    const flaggedQuestions = await sql`
      SELECT question_id
      FROM flagged_questions
      WHERE attempt_id = ${attemptId}
    `

    // Get used hints for this attempt
    const usedHints = await sql`
      SELECT question_id
      FROM hint_usage
      WHERE attempt_id = ${attemptId}
    `

    // All questions with any saved row (draft autosave or evaluated) — for badges / analytics
    const savedAnswers = await sql`
      SELECT DISTINCT question_id
      FROM quiz_answers
      WHERE attempt_id = ${attemptId}
        AND (selected_answer IS NOT NULL OR answer_data IS NOT NULL)
    `
    const answeredQuestionIds = savedAnswers.map((r: { question_id: number }) => r.question_id)

    // Lockable types only: MCQ/TF/select-all that are FINALIZED (not draft autosave).
    // CRITICAL: Do NOT treat every quiz_answers row as "submitted/locked". Auto-save writes
    // rows for code questions with answer_data.autoSave=true; treating those as locked
    // locked students out of editing code and blocked resume navigation. Code questions are
    // never in this list (they rely on client state + autoSave flag only for lockables).
    const lockableFinalized = await sql`
      SELECT qa.question_id
      FROM quiz_answers qa
      INNER JOIN quiz_questions qq ON qq.id = qa.question_id AND qq.quiz_id = ${quizId}
      WHERE qa.attempt_id = ${attemptId}
        AND (qa.selected_answer IS NOT NULL OR qa.answer_data IS NOT NULL)
        AND LOWER(COALESCE(qq.question_type, '')) IN ('mcq', 'true_false', 'select_all', 'multi_output')
        AND ${sql.unsafe(LOCKABLE_ANSWER_FINALIZED_SQL)}
    `

    // Circuit submissions are one-time: lock after submit/grade (not draft autosave).
    const circuitFinalized = await sql`
      SELECT qa.question_id
      FROM quiz_answers qa
      INNER JOIN quiz_questions qq ON qq.id = qa.question_id AND qq.quiz_id = ${quizId}
      WHERE qa.attempt_id = ${attemptId}
        AND LOWER(COALESCE(qq.question_type, '')) = 'circuit_submission'
        AND (qa.selected_answer IS NOT NULL OR qa.answer_data IS NOT NULL)
        AND ${sql.unsafe(CIRCUIT_ANSWER_FINALIZED_SQL)}
    `

    const submittedQuestionIds = [
      ...new Set([
        ...lockableFinalized.map((r: { question_id: number }) => r.question_id),
        ...circuitFinalized.map((r: { question_id: number }) => r.question_id),
      ]),
    ]

    let restartPolicy: { canRestart: boolean; blockedReason?: string } = { canRestart: true }
    if (!completedAt) {
      const { getAttemptRestartPolicy } = await import("@/lib/restart-saved-attempt")
      restartPolicy = await getAttemptRestartPolicy(
        attemptId,
        studentDatabaseId,
        parseInt(String(quizId), 10),
        {
          savedForLaterAt: savedForLaterAt ?? null,
          violationLog: (attempt as { violation_log?: unknown }).violation_log,
          finalizedProgressCount: submittedQuestionIds.length,
        },
      )
    }

    console.log("[quiz-attempt API] response", {
      attemptId,
      completedAt: completedAt?.toISOString?.(),
      currentQuestionIndex,
      answeredQuestionIds,
      submittedQuestionIds,
      savedAnswersCount: savedAnswers.length,
    })

    const response = {
      attemptId,
      completedAt: completedAt?.toISOString?.() ?? completedAt ?? null,
      questionTimeRemaining: questionTimeRemaining ?? null,
      sectionTimeRemaining: sectionTimeRemainingOut ?? null,
      savedForLaterAt: savedForLaterAt
        ? (savedForLaterAt instanceof Date
            ? savedForLaterAt.toISOString()
            : String(savedForLaterAt))
        : null,
      sectionQuestionSelections: sectionQuestionSelections ?? null,
      currentQuestionIndex,
      remainingTime,
      hasSaveAndFinishLaterAccess: hasSaveLater,
      superpowers: normalizeSuperpowerListFromUnknown((attempt as { superpowers?: unknown }).superpowers),
      flaggedQuestionIds: flaggedQuestions.map((q: any) => q.question_id),
      usedHintQuestionIds: usedHints.map((h: any) => h.question_id),
      submittedQuestionIds,
      lockedQuestionIds: submittedQuestionIds,
      answeredQuestionIds,
      canRestart: restartPolicy.canRestart,
      restartBlockedReason: restartPolicy.blockedReason ?? null,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error("[v0] Failed to fetch quiz attempt:", error)
    return NextResponse.json(
      {
        error: "Failed to fetch quiz attempt",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
