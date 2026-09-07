/**
 * Clear stale submissionFailed flags after a successful graded submit.
 * Prevents diagnostic scans from reporting resolved network-timeout fallbacks.
 */

import { sql } from "@/lib/db"

export async function clearSubmissionFailedFlag(
  attemptId: number,
  questionId: number,
): Promise<boolean> {
  const rows = await sql`
    SELECT answer_data, requires_review
    FROM quiz_answers
    WHERE attempt_id = ${attemptId} AND question_id = ${questionId}
    LIMIT 1
  `
  if (!rows.length) return false

  const raw = rows[0].answer_data
  let data: Record<string, unknown>
  try {
    data =
      typeof raw === "string"
        ? (JSON.parse(raw) as Record<string, unknown>)
        : ((raw as Record<string, unknown>) ?? {})
  } catch {
    return false
  }

  const hadFlag =
    data.submissionFailed === true ||
    data.submissionFailed === "true" ||
    String(data.submissionFailed ?? "").toLowerCase() === "true"

  if (!hadFlag && !rows[0].requires_review) return false

  delete data.submissionFailed
  delete data.submission_error_type
  delete data.submission_retry_count

  await sql`
    UPDATE quiz_answers
    SET
      answer_data = ${JSON.stringify(data)}::jsonb,
      requires_review = false
    WHERE attempt_id = ${attemptId} AND question_id = ${questionId}
  `
  return true
}
