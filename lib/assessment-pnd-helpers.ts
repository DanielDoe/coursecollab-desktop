/**
 * Shared helpers for PND detection on attempts (same rules as student results / fix-pnd script).
 */
import { sql } from "@/lib/db"
import { computeShouldShowPnd, deriveViolationLogAndShouldShowPnd, type QuestionRowForPnd } from "@/lib/results-pnd"

export async function loadPndContextForAttempt(attemptId: number): Promise<{
  attempt: { violation_log: unknown; quiz_id: number; student_id: number }
  questions: QuestionRowForPnd[]
} | null> {
  const att = await sql`
    SELECT qa.id, qa.quiz_id, qa.student_id, COALESCE(qa.violation_log, '[]'::jsonb) as violation_log
    FROM quiz_attempts qa
    WHERE qa.id = ${attemptId} AND qa.deleted_at IS NULL
  `
  if (att.length === 0) return null
  const row = att[0] as {
    quiz_id: number
    student_id: number
    violation_log: unknown
  }
  const quizId = row.quiz_id

  const qrows = await sql`
    SELECT qq.question_type,
      COALESCE(qa.override_points, qa.points_earned, 0) as points_earned,
      qa.answer_data,
      qa.selected_answer,
      COALESCE(qa.requires_review, false) as requires_review,
      qa.override_points,
      qa.reviewed_by,
      qa.reviewed_at
    FROM quiz_questions qq
    LEFT JOIN quiz_answers qa ON qa.question_id = qq.id AND qa.attempt_id = ${attemptId}
    WHERE qq.quiz_id = ${quizId}
    ORDER BY qq.question_order ASC NULLS LAST, qq.id ASC
  `

  const questions: QuestionRowForPnd[] = (qrows as any[]).map((q) => ({
    question_type: q.question_type,
    points_earned: q.points_earned != null ? Number(q.points_earned) : 0,
    answer_data: q.answer_data,
    selected_answer: q.selected_answer,
    requires_review: q.requires_review === true,
    override_points: q.override_points != null ? Number(q.override_points) : null,
    reviewed_by: q.reviewed_by ?? null,
    reviewed_at: q.reviewed_at != null ? String(q.reviewed_at) : null,
  }))

  return {
    attempt: { violation_log: row.violation_log, quiz_id: row.quiz_id, student_id: row.student_id },
    questions,
  }
}

/**
 * Persists violation_log to match PND derivation (clears stale score_pending when no longer reviewable).
 * Call after instructor/student bulk re-grade when all answers are updated.
 */
export async function syncAttemptViolationLogFromPndRules(attemptId: number): Promise<void> {
  const ctx = await loadPndContextForAttempt(attemptId)
  if (!ctx) return
  const { violationLog } = deriveViolationLogAndShouldShowPnd(ctx.attempt, ctx.questions)
  await sql`
    UPDATE quiz_attempts
    SET violation_log = ${JSON.stringify(violationLog)}::jsonb
    WHERE id = ${attemptId}
  `
}

export async function hasInstructorOverridesOnAttempt(attemptId: number): Promise<boolean> {
  const r = await sql`
    SELECT 1 FROM quiz_answers
    WHERE attempt_id = ${attemptId} AND override_points IS NOT NULL
    LIMIT 1
  `
  return r.length > 0
}

export type ListQuizReevaluateAttemptsOptions = {
  skipInstructorOverrides?: boolean
  /** When set, only attempts whose student belongs to this class session (students.session_id). */
  sessionId?: number | null
}

/**
 * List completed attempt IDs for a quiz. Pending = same PND% heuristic as student report (skips override rows).
 */
export async function listAttemptIdsForQuizReevaluate(
  quizId: number,
  scope: "all" | "pending",
  options?: ListQuizReevaluateAttemptsOptions
): Promise<number[]> {
  const skipOverrides = options?.skipInstructorOverrides !== false
  const sessionId = options?.sessionId ?? null

  const rows =
    sessionId != null
      ? await sql`
          SELECT qa.id
          FROM quiz_attempts qa
          INNER JOIN students s ON s.id = qa.student_id
          WHERE qa.quiz_id = ${quizId}
            AND qa.completed_at IS NOT NULL
            AND qa.deleted_at IS NULL
            AND s.session_id = ${sessionId}
          ORDER BY qa.completed_at DESC NULLS LAST, qa.id DESC
        `
      : await sql`
          SELECT id FROM quiz_attempts
          WHERE quiz_id = ${quizId}
            AND completed_at IS NOT NULL
            AND deleted_at IS NULL
          ORDER BY completed_at DESC NULLS LAST, id DESC
        `
  const ids = (rows as { id: number }[]).map((r) => r.id)

  if (scope === "all") return ids

  const pending: number[] = []
  for (const id of ids) {
    if (skipOverrides && (await hasInstructorOverridesOnAttempt(id))) continue
    const ctx = await loadPndContextForAttempt(id)
    if (!ctx) continue
    if (computeShouldShowPnd(ctx.attempt, ctx.questions)) pending.push(id)
  }
  return pending
}

/** Same ordering as `listAttemptIdsForQuizReevaluate`, with display name for UI. */
export async function listAttemptSummariesForQuizReevaluate(
  quizId: number,
  scope: "all" | "pending",
  options?: ListQuizReevaluateAttemptsOptions
): Promise<{ id: number; studentName: string }[]> {
  const ids = await listAttemptIdsForQuizReevaluate(quizId, scope, options)
  if (ids.length === 0) return []

  const rows = await sql`
    SELECT
      qa.id,
      COALESCE(
        NULLIF(TRIM(s.full_name), ''),
        CASE
          WHEN s.student_id IS NOT NULL AND TRIM(s.student_id::text) <> '' THEN 'ID ' || TRIM(s.student_id::text)
          ELSE NULL
        END,
        'Unknown student'
      ) AS student_name
    FROM quiz_attempts qa
    LEFT JOIN students s ON s.id = qa.student_id
    WHERE qa.id = ANY(${ids})
  `
  const byId = new Map(
    (rows as { id: number; student_name: string }[]).map((r) => [r.id, r.student_name])
  )
  return ids.map((id) => ({ id, studentName: byId.get(id) ?? "Unknown student" }))
}
