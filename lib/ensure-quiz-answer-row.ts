import { sql } from "@/lib/db"

/**
 * Ensure a quiz_answers row exists for (attempt, question). Used when the student never saved
 * an answer but instructors still need manual override / re-evaluate on the results page.
 */
export async function ensureQuizAnswerIdForAttemptQuestion(
  attemptId: number,
  questionId: number,
): Promise<number> {
  const valid = await sql`
    SELECT 1
    FROM quiz_attempts qat
    JOIN quiz_questions qq ON qq.quiz_id = qat.quiz_id AND qq.id = ${questionId}
    WHERE qat.id = ${attemptId}
    LIMIT 1
  `
  if (valid.length === 0) {
    throw new Error("Attempt and question do not belong to the same quiz")
  }

  const existing = await sql`
    SELECT id FROM quiz_answers
    WHERE attempt_id = ${attemptId} AND question_id = ${questionId}
    LIMIT 1
  `
  if (existing.length > 0) {
    return Number((existing[0] as { id: number }).id)
  }

  const ins = await sql`
    INSERT INTO quiz_answers (
      attempt_id,
      question_id,
      selected_answer,
      answer_data,
      is_correct,
      answered_at,
      points_earned,
      requires_review
    )
    VALUES (
      ${attemptId},
      ${questionId},
      NULL,
      NULL,
      false,
      NOW(),
      0,
      false
    )
    RETURNING id
  `
  return Number((ins[0] as { id: number }).id)
}
