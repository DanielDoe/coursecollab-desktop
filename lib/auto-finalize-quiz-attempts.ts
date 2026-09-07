import { sql } from "@/lib/db"
import { getAttemptDisplayGradesBatch } from "@/lib/attempt-grade-display"
import {
  type AutoFinalizeGrading,
  pickSingleFinalAttemptId,
  normalizeQuizRetakePolicyForAutoFinalize,
} from "@/lib/retake-auto-finalize"

export type AutoFinalizeQuizAttemptsOptions = {
  quizId: number
  gradingPolicy: AutoFinalizeGrading
  /** Bulk / CLI runs should skip per-student notifications. */
  skipNotifications?: boolean
}

export type AutoFinalizeQuizAttemptsResult = {
  finalizedCount: number
  skippedCount: number
}

async function loadSubmittedQuestionCounts(
  attemptIds: number[],
): Promise<Map<number, number>> {
  const counts = new Map<number, number>()
  if (attemptIds.length === 0) return counts

  const rows = await sql`
    SELECT
      ans.attempt_id,
      COUNT(DISTINCT ans.question_id)::int AS submitted_count
    FROM quiz_answers ans
    WHERE ans.attempt_id = ANY(${attemptIds})
      AND (
        ans.answered_at IS NOT NULL
        OR NULLIF(TRIM(COALESCE(ans.selected_answer, '')), '') IS NOT NULL
        OR (
          ans.answer_data IS NOT NULL
          AND ans.answer_data::text NOT IN ('null', '{}', '""', '')
        )
      )
    GROUP BY ans.attempt_id
  `

  for (const row of rows as { attempt_id: number; submitted_count: number }[]) {
    counts.set(Number(row.attempt_id), Number(row.submitted_count) || 0)
  }
  return counts
}

/**
 * For one quiz: every student with attempts gets exactly one `is_final_grade` row
 * (or all completed marked final for `average`), matching instructor auto-finalize.
 */
export async function autoFinalizeQuizAttemptsForQuiz(
  options: AutoFinalizeQuizAttemptsOptions,
): Promise<AutoFinalizeQuizAttemptsResult> {
  const { quizId, gradingPolicy, skipNotifications = true } = options

  const completedIdRows = await sql`
    SELECT id FROM quiz_attempts
    WHERE quiz_id = ${quizId} AND deleted_at IS NULL AND completed_at IS NOT NULL
  `
  const displayGrades = await getAttemptDisplayGradesBatch(
    (completedIdRows as { id: number }[]).map((r) => Number(r.id)),
  )

  const studentsWithAttempts = await sql`
    SELECT DISTINCT qa.student_id
    FROM quiz_attempts qa
    WHERE qa.quiz_id = ${quizId}
      AND qa.deleted_at IS NULL
  `

  let finalizedCount = 0
  let skippedCount = 0

  for (const student of studentsWithAttempts as { student_id: number }[]) {
    const attempts = await sql`
      SELECT 
        qa.id,
        qa.score,
        qa.completed_at,
        qa.started_at,
        EXTRACT(EPOCH FROM (qa.completed_at - qa.started_at))::integer as time_taken_seconds
      FROM quiz_attempts qa
      WHERE qa.student_id = ${student.student_id}
        AND qa.quiz_id = ${quizId}
        AND qa.deleted_at IS NULL
      ORDER BY qa.completed_at DESC NULLS LAST, qa.started_at DESC
    `

    if (attempts.length === 0) {
      skippedCount++
      continue
    }

    const completedAttempts = attempts.filter(
      (a: { completed_at: unknown }) => a.completed_at !== null,
    ) as {
      id: number
      score: unknown
      completed_at: unknown
      started_at: unknown
      time_taken_seconds: number | null
    }[]

    const submittedCounts = await loadSubmittedQuestionCounts(
      completedAttempts.map((a) => a.id),
    )
    const completedWithCoverage = completedAttempts.map((a) => {
      const displayPct = displayGrades.get(a.id)?.percentage
      const scoreForPick =
        gradingPolicy === "highest" && displayPct != null && !Number.isNaN(displayPct)
          ? displayPct
          : parseFloat(String(a.score ?? 0)) || 0
      return {
        ...a,
        score: scoreForPick,
        submitted_question_count: submittedCounts.get(a.id) ?? 0,
      }
    })

    if (completedAttempts.length === 0) {
      const incompleteAttempt = attempts[0] as { id: number }
      const { finalizeAttempt } = await import("@/lib/finalize-utils")
      const result = await finalizeAttempt(incompleteAttempt.id, quizId)
      if (result.finalized) {
        await sql`
          UPDATE quiz_attempts SET is_final_grade = false
          WHERE student_id = ${student.student_id} AND quiz_id = ${quizId}
        `
        await sql`
          UPDATE quiz_attempts SET is_final_grade = true
          WHERE id = ${incompleteAttempt.id}
        `
        finalizedCount++
      }
      continue
    }

    if (gradingPolicy === "average") {
      await sql`
        UPDATE quiz_attempts
        SET is_final_grade = false
        WHERE student_id = ${student.student_id} AND quiz_id = ${quizId}
      `
      await sql`
        UPDATE quiz_attempts
        SET is_final_grade = true
        WHERE student_id = ${student.student_id}
          AND quiz_id = ${quizId}
          AND completed_at IS NOT NULL
          AND deleted_at IS NULL
      `
      finalizedCount++
      continue
    }

    const selectedAttemptId = pickSingleFinalAttemptId(completedWithCoverage, gradingPolicy)
    if (selectedAttemptId == null) {
      skippedCount++
      continue
    }

    await sql`
      UPDATE quiz_attempts
      SET is_final_grade = false
      WHERE student_id = ${student.student_id} AND quiz_id = ${quizId}
    `
    await sql`
      UPDATE quiz_attempts
      SET is_final_grade = true
      WHERE id = ${selectedAttemptId}
    `

    if (!skipNotifications) {
      try {
        const quizInfo = await sql`
          SELECT title, assessment_type FROM quizzes WHERE id = ${quizId} LIMIT 1
        `
        if (quizInfo.length > 0) {
          const selectedAttempt = completedWithCoverage.find((a) => a.id === selectedAttemptId)
          await sql`
            INSERT INTO notifications (
              student_id, 
              title, 
              message, 
              type, 
              link, 
              created_at
            ) VALUES (
              ${student.student_id},
              'Grade Finalized',
              ${`Your final grade for ${(quizInfo[0] as { title: string }).title} has been recorded: ${Number(selectedAttempt?.score ?? 0).toFixed(2)}%`},
              'grade',
              ${`/student/results/${selectedAttemptId}`},
              NOW()
            )
          `
        }
      } catch {
        // same as route: do not fail finalization
      }
    }

    finalizedCount++
  }

  return { finalizedCount, skippedCount }
}

/**
 * After submit / re-grade: pick one `is_final_grade` row using display % (not raw points).
 * Matches Canvas export and instructor Results → Final.
 */
export async function reconcileFinalGradeFlagsForStudent(
  quizId: number,
  studentId: number,
): Promise<void> {
  const [quizRow] = await sql`
    SELECT retake_policy FROM quizzes WHERE id = ${quizId} FOR UPDATE
  `
  if (!quizRow) return

  const gradingPolicy = normalizeQuizRetakePolicyForAutoFinalize(
    (quizRow as { retake_policy: string | null }).retake_policy,
  )

  const attempts = await sql`
    SELECT
      qa.id,
      qa.score,
      qa.completed_at,
      qa.started_at,
      EXTRACT(EPOCH FROM (qa.completed_at - qa.started_at))::integer as time_taken_seconds
    FROM quiz_attempts qa
    WHERE qa.student_id = ${studentId}
      AND qa.quiz_id = ${quizId}
      AND qa.deleted_at IS NULL
    ORDER BY qa.completed_at DESC NULLS LAST, qa.started_at DESC
  `

  if (attempts.length === 0) return

  const completedAttempts = attempts.filter(
    (a: { completed_at: unknown }) => a.completed_at !== null,
  ) as {
    id: number
    score: unknown
    completed_at: unknown
    started_at: unknown
    time_taken_seconds: number | null
  }[]

  if (gradingPolicy === "average") {
    await sql`
      UPDATE quiz_attempts SET is_final_grade = false
      WHERE student_id = ${studentId} AND quiz_id = ${quizId}
    `
    await sql`
      UPDATE quiz_attempts SET is_final_grade = true
      WHERE student_id = ${studentId} AND quiz_id = ${quizId}
        AND completed_at IS NOT NULL AND deleted_at IS NULL
    `
    return
  }

  const completedIdRows = completedAttempts.map((a) => a.id)
  const displayGrades = await getAttemptDisplayGradesBatch(completedIdRows)
  const submittedCounts = await loadSubmittedQuestionCounts(completedIdRows)
  const completedWithCoverage = completedAttempts.map((a) => {
    const displayPct = displayGrades.get(a.id)?.percentage
    const scoreForPick =
      gradingPolicy === "highest" && displayPct != null && !Number.isNaN(displayPct)
        ? displayPct
        : parseFloat(String(a.score ?? 0)) || 0
    return {
      ...a,
      score: scoreForPick,
      submitted_question_count: submittedCounts.get(a.id) ?? 0,
    }
  })

  if (completedWithCoverage.length === 0) {
    const incompleteAttempt = attempts[0] as { id: number }
    await sql`
      UPDATE quiz_attempts SET is_final_grade = false
      WHERE student_id = ${studentId} AND quiz_id = ${quizId}
    `
    await sql`
      UPDATE quiz_attempts SET is_final_grade = true WHERE id = ${incompleteAttempt.id}
    `
    return
  }

  const selectedAttemptId = pickSingleFinalAttemptId(
    completedWithCoverage,
    gradingPolicy as Exclude<typeof gradingPolicy, "average">,
  )
  if (selectedAttemptId == null) return

  await sql`
    UPDATE quiz_attempts SET is_final_grade = false
    WHERE student_id = ${studentId} AND quiz_id = ${quizId}
  `
  await sql`
    UPDATE quiz_attempts SET is_final_grade = true WHERE id = ${selectedAttemptId}
  `
}
