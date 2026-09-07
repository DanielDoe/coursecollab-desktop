import { sql } from "@/lib/db"
import { hasStudentAnswerContent } from "@/lib/student-answer-presence"
import { canVerifyLocally } from "@/lib/local-answer-verification"

/**
 * Clears erroneous requires_review on answers where the student submitted nothing
 * ("No answer provided" + 0 pts is valid — nothing to review).
 * Call during finalize / recalculate score so totals and PND flags stay consistent.
 */
export async function clearRequiresReviewForEmptyAnswers(attemptId: number): Promise<number> {
  const rows = await sql`
    SELECT qa.id, qa.selected_answer, qa.answer_data, qq.question_type
    FROM quiz_answers qa
    INNER JOIN quiz_questions qq ON qq.id = qa.question_id
    WHERE qa.attempt_id = ${attemptId} AND qa.requires_review = true
  `
  let cleared = 0
  for (const row of rows as Array<{
    id: number
    selected_answer: unknown
    answer_data: unknown
    question_type: string
  }>) {
    if (
      !hasStudentAnswerContent({
        question_type: row.question_type,
        selected_answer: row.selected_answer,
        answer_data: row.answer_data,
        code: null,
      })
    ) {
      await sql`
        UPDATE quiz_answers
        SET requires_review = false
        WHERE id = ${row.id}
      `
      cleared++
    }
  }
  return cleared
}

/**
 * Clears stale requires_review on auto-gradable keyed questions (MCQ, T/F, select all, …)
 * that already have a recorded grade from the answer key.
 */
export async function clearRequiresReviewForAutoGradedAnswers(attemptId: number): Promise<number> {
  const rows = await sql`
    SELECT qa.id, qa.is_correct, qa.points_earned, qa.reviewed_at, qa.reviewed_by, qq.question_type
    FROM quiz_answers qa
    INNER JOIN quiz_questions qq ON qq.id = qa.question_id
    WHERE qa.attempt_id = ${attemptId} AND qa.requires_review = true
  `
  let cleared = 0
  for (const row of rows as Array<{
    id: number
    is_correct: boolean | null
    points_earned: string | number | null
    reviewed_at: string | null
    reviewed_by: string | null
    question_type: string
  }>) {
    if (!canVerifyLocally(row.question_type || "")) continue

    const points = Number(row.points_earned ?? 0)
    const hasReviewStamp =
      (row.reviewed_at != null && String(row.reviewed_at).trim() !== "") ||
      (row.reviewed_by != null && String(row.reviewed_by).trim() !== "")
    const graded =
      row.is_correct === true ||
      (row.is_correct === false && hasReviewStamp) ||
      points > 0 ||
      row.reviewed_by === "student:self"

    if (!graded) continue

    await sql`
      UPDATE quiz_answers
      SET requires_review = false
      WHERE id = ${row.id}
    `
    cleared++
  }
  return cleared
}
