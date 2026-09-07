import { sql } from "@/lib/db"
import { normalizeQuestionBankRowForStorage } from "@/lib/question-type-schema"

const OPTION_TYPES = new Set([
  "mcq",
  "multiple_choice",
  "true_false",
  "select_all",
  "multi_output",
])

/**
 * Re-normalize one question_bank row in place (MCQ / T-F / select-all).
 * When destinationCourseId is set, only rows in that course are updated (course exchange clone guard).
 */
export async function persistNormalizedQuestionBankRow(
  questionId: number,
  destinationCourseId?: number,
): Promise<boolean> {
  const rows =
    destinationCourseId != null
      ? await sql`
          SELECT id, question_type, options, correct_answer
          FROM question_bank
          WHERE id = ${questionId}
            AND course_id = ${destinationCourseId}
            AND deleted_at IS NULL
          LIMIT 1
        `
      : await sql`
          SELECT id, question_type, options, correct_answer
          FROM question_bank
          WHERE id = ${questionId}
            AND deleted_at IS NULL
          LIMIT 1
        `
  if (rows.length === 0) return false

  const row = rows[0] as {
    id: number
    question_type: string
    options: unknown
    correct_answer: unknown
  }
  const type = row.question_type.toLowerCase()
  if (!OPTION_TYPES.has(type)) return false

  const normalized = normalizeQuestionBankRowForStorage({
    question_type: row.question_type,
    options: row.options,
    correct_answer: row.correct_answer,
  })

  if (destinationCourseId != null) {
    await sql`
      UPDATE question_bank
      SET options = ${JSON.stringify(normalized.options)}::jsonb,
          correct_answer = ${JSON.stringify(normalized.correct_answer)}::jsonb,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${questionId}
        AND course_id = ${destinationCourseId}
    `
  } else {
    await sql`
      UPDATE question_bank
      SET options = ${JSON.stringify(normalized.options)}::jsonb,
          correct_answer = ${JSON.stringify(normalized.correct_answer)}::jsonb,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${questionId}
    `
  }
  return true
}
