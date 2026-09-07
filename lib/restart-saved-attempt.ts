import { sql } from "@/lib/db"
import { canRetakeAssessment, getCompletedAttemptCount } from "@/lib/retake-utils"
import { hasDeadlineExtensionForStudentQuiz } from "@/lib/deadline-extension"
import { isBetaUser } from "@/lib/membership"
import {
  CIRCUIT_ANSWER_FINALIZED_SQL,
  LOCKABLE_ANSWER_FINALIZED_SQL,
} from "@/lib/quiz-answer-data-sql"

export type RestartSavedAttemptResult =
  | { ok: true; attemptId: number; attemptNumber: number }
  | { ok: false; error: string; status: number; canRetake?: boolean }

export type AttemptRestartPolicy = {
  canRestart: boolean
  blockedReason?: string
}

/** Client-facing restart eligibility for an incomplete attempt (resume dialog). */
export async function getAttemptRestartPolicy(
  attemptId: number,
  studentDatabaseId: number,
  quizId: number,
  opts: {
    savedForLaterAt: Date | string | null
    violationLog: unknown
    finalizedProgressCount: number
  },
): Promise<AttemptRestartPolicy> {
  const violationLog = Array.isArray(opts.violationLog) ? opts.violationLog : []
  const restartCount = violationLog.filter(
    (e: { type?: string }) => e?.type === "attempt_restart",
  ).length
  if (restartCount >= 1) {
    return {
      canRestart: false,
      blockedReason:
        "You have already restarted this saved attempt. Continue your current progress or submit when finished.",
    }
  }

  const completedCount = await getCompletedAttemptCount(studentDatabaseId, quizId)

  if (opts.finalizedProgressCount > 0 && completedCount === 0) {
    return {
      canRestart: false,
      blockedReason:
        "You already have progress on this attempt. Continue where you left off — restart is not available until you've submitted this attempt.",
    }
  }

  if (opts.savedForLaterAt && opts.finalizedProgressCount > 0) {
    const quizSettings = await sql`
      SELECT
        COALESCE(retake_enabled, false) as retake_enabled,
        retake_limit,
        available_until
      FROM quizzes
      WHERE id = ${quizId}
      LIMIT 1
    `
    if (quizSettings.length === 0) {
      return { canRestart: false, blockedReason: "Quiz not found" }
    }

    const isBeta = await isBetaUser(studentDatabaseId)
    const hasDeadlineExt = await hasDeadlineExtensionForStudentQuiz(studentDatabaseId, quizId)
    const retakeCheck = await canRetakeAssessment(
      studentDatabaseId,
      quizId,
      quizSettings[0].retake_limit,
      quizSettings[0].retake_enabled,
      completedCount,
      false,
      {
        availableUntil: quizSettings[0].available_until,
        hasDeadlineExtension: hasDeadlineExt,
        bypassCalendarRetakeExpiry: isBeta,
      },
    )
    if (!retakeCheck.canRetake) {
      return {
        canRestart: false,
        blockedReason:
          retakeCheck.reason ||
          "You have no retakes remaining. Continue your saved progress instead of starting over.",
      }
    }
  }

  return { canRestart: true }
}

/**
 * Reset a saved-for-later attempt in place (same attempt id → same question shuffle seed).
 * Counts as a retake when the student had saved answers — blocks infinite save/restart loops.
 */
export async function restartSavedAttempt(
  attemptId: number,
  studentDatabaseId: number,
  quizId: number,
): Promise<RestartSavedAttemptResult> {
  const rows = await sql`
    SELECT id, attempt_number, student_id, quiz_id, completed_at, saved_for_later_at,
           COALESCE(violation_log, '[]'::jsonb) as violation_log
    FROM quiz_attempts
    WHERE id = ${attemptId}
      AND student_id = ${studentDatabaseId}
      AND quiz_id = ${quizId}
      AND deleted_at IS NULL
    LIMIT 1
    FOR UPDATE
  `

  if (rows.length === 0) {
    return { ok: false, error: "Attempt not found", status: 404 }
  }

  const attempt = rows[0]
  if (attempt.completed_at) {
    return { ok: false, error: "Attempt already submitted", status: 400 }
  }

  if (!attempt.saved_for_later_at) {
    return { ok: false, error: "Restart in place is only allowed for saved attempts", status: 400 }
  }

  const violationLog = Array.isArray(attempt.violation_log) ? attempt.violation_log : []
  const restartCount = violationLog.filter(
    (e: { type?: string }) => e?.type === "attempt_restart",
  ).length
  if (restartCount >= 1) {
    return {
      ok: false,
      error:
        "You have already restarted this saved attempt. Continue your current progress or submit when finished.",
      status: 403,
    }
  }

  const finalizedProgressResult = await sql`
    SELECT COUNT(DISTINCT qa.question_id)::int as count
    FROM quiz_answers qa
    INNER JOIN quiz_questions qq ON qq.id = qa.question_id AND qq.quiz_id = ${quizId}
    WHERE qa.attempt_id = ${attemptId}
      AND (qa.selected_answer IS NOT NULL OR qa.answer_data IS NOT NULL)
      AND (
        (
          LOWER(COALESCE(qq.question_type, '')) IN ('mcq', 'true_false', 'select_all', 'multi_output')
          AND ${sql.unsafe(LOCKABLE_ANSWER_FINALIZED_SQL)}
        )
        OR (
          LOWER(COALESCE(qq.question_type, '')) = 'circuit_submission'
          AND ${sql.unsafe(CIRCUIT_ANSWER_FINALIZED_SQL)}
        )
      )
  `
  const finalizedProgressCount = Number(finalizedProgressResult[0]?.count ?? 0)

  const completedCount = await getCompletedAttemptCount(studentDatabaseId, quizId)

  // First attempt with submitted progress: restart would wipe answers and let students
  // re-take after seeing feedback — only Continue is allowed until they submit.
  if (finalizedProgressCount > 0 && completedCount === 0) {
    return {
      ok: false,
      error:
        "You already have progress on this attempt. Continue where you left off — restart is not available until you've submitted this attempt.",
      status: 403,
    }
  }

  if (finalizedProgressCount > 0) {
    const quizSettings = await sql`
      SELECT
        COALESCE(retake_enabled, false) as retake_enabled,
        retake_limit,
        available_until
      FROM quizzes
      WHERE id = ${quizId}
      LIMIT 1
    `
    if (quizSettings.length === 0) {
      return { ok: false, error: "Quiz not found", status: 404 }
    }

    const isBeta = await isBetaUser(studentDatabaseId)
    const hasDeadlineExt = await hasDeadlineExtensionForStudentQuiz(studentDatabaseId, quizId)

    const retakeCheck = await canRetakeAssessment(
      studentDatabaseId,
      quizId,
      quizSettings[0].retake_limit,
      quizSettings[0].retake_enabled,
      completedCount,
      false,
      {
        availableUntil: quizSettings[0].available_until,
        hasDeadlineExtension: hasDeadlineExt,
        bypassCalendarRetakeExpiry: isBeta,
      },
    )

    if (!retakeCheck.canRetake) {
      return {
        ok: false,
        error:
          retakeCheck.reason ||
          "You have no retakes remaining. Continue your saved progress instead of starting over.",
        status: 403,
        canRetake: false,
      }
    }
  }

  await sql`DELETE FROM quiz_answers WHERE attempt_id = ${attemptId}`

  try {
    await sql`ALTER TABLE quiz_attempts DISABLE TRIGGER trigger_update_profile_after_quiz`
  } catch (_) {}

  const updatedLog = [
    ...violationLog,
    {
      type: "attempt_restart",
      timestamp: new Date().toISOString(),
      message: "Student restarted a saved attempt in place (same question order).",
    },
  ]

  try {
    await sql`
      UPDATE quiz_attempts
      SET
        saved_for_later_at = NULL,
        question_time_remaining = NULL,
        current_question_index = 0,
        remaining_time = NULL,
        last_saved_at = NULL,
        started_at = NOW(),
        score = 0,
        total_questions = 0,
        violation_log = ${JSON.stringify(updatedLog)}::jsonb
      WHERE id = ${attemptId}
    `
  } finally {
    try {
      await sql`ALTER TABLE quiz_attempts ENABLE TRIGGER trigger_update_profile_after_quiz`
    } catch (_) {}
  }

  return {
    ok: true,
    attemptId: attempt.id,
    attemptNumber: attempt.attempt_number,
  }
}
