/**
 * E2E helpers — never soft-delete completed student attempts.
 */
import { sql } from "@/lib/db"

/** Soft-delete only incomplete attempts so prior graded scores remain in history. */
export async function clearIncompleteStudentAttempts(studentId: number, quizId: number): Promise<number> {
  const rows = await sql`
    UPDATE quiz_attempts
    SET deleted_at = NOW()
    WHERE student_id = ${studentId}
      AND quiz_id = ${quizId}
      AND completed_at IS NULL
      AND deleted_at IS NULL
    RETURNING id
  `
  return rows.length
}

/** @deprecated Use clearIncompleteStudentAttempts — completed attempts must be preserved. */
export async function clearStudentAttempts(studentId: number, quizId: number): Promise<number> {
  return clearIncompleteStudentAttempts(studentId, quizId)
}

export async function createFreshAttempt(
  studentId: number,
  quizId: number,
  questionCount: number,
): Promise<number> {
  await clearIncompleteStudentAttempts(studentId, quizId)
  const maxAttempt = await sql`
    SELECT COALESCE(MAX(attempt_number), 0) + 1 AS next_num
    FROM quiz_attempts
    WHERE student_id = ${studentId} AND quiz_id = ${quizId}
  `
  const attemptNumber = Number((maxAttempt[0] as { next_num: number })?.next_num ?? 1)
  const inserted = await sql`
    INSERT INTO quiz_attempts (student_id, quiz_id, attempt_number, started_at, score, total_questions)
    VALUES (${studentId}, ${quizId}, ${attemptNumber}, NOW(), 0, ${questionCount})
    RETURNING id
  `
  return Number((inserted[0] as { id: number }).id)
}
