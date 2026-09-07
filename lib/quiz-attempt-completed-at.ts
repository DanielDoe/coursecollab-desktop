import { sql } from "@/lib/db"

/**
 * SQL expression: best-effort completion timestamp when `completed_at` was never stamped * (legacy paths set score / is_final_grade without finalizing). Uses instructor review time,
 * last answer save, then omits (NULL) for in-progress attempts.
 *
 * @param alias Table alias for `quiz_attempts` (e.g. `qa`, `att`)
 */
export function quizAttemptEffectiveCompletedAtExpr(alias: string): string {
  const a = alias.trim() || "qa"
  return `COALESCE(
  ${a}.completed_at,
  CASE    WHEN ${a}.is_final_grade = true OR ${a}.total_score_override IS NOT NULL THEN
      (SELECT MAX(qans.reviewed_at) FROM quiz_answers qans WHERE qans.attempt_id = ${a}.id)
    ELSE NULL
  END,
  CASE
    WHEN ${a}.is_final_grade = true OR ${a}.total_score_override IS NOT NULL THEN
      (SELECT MAX(qans.answered_at) FROM quiz_answers qans WHERE qans.attempt_id = ${a}.id)
    ELSE NULL
  END
)`
}

/**
 * Persist `completed_at` when a graded attempt was never stamped — fixes export, duration, and N/A in lists.
 */
export async function ensureQuizAttemptCompletedAtStamped(attemptId: number): Promise<void> {
  await sql`
    UPDATE quiz_attempts qa
    SET completed_at = COALESCE(
      qa.completed_at,
      (SELECT MAX(qans.reviewed_at) FROM quiz_answers qans WHERE qans.attempt_id = qa.id),
      (SELECT MAX(qans.answered_at) FROM quiz_answers qans WHERE qans.attempt_id = qa.id),
      NOW()
    )
    WHERE qa.id = ${attemptId}
      AND qa.completed_at IS NULL
      AND qa.deleted_at IS NULL
      AND (
        qa.is_final_grade = true
        OR qa.total_score_override IS NOT NULL
      )
  `
}
