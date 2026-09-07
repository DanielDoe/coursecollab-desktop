import { sql } from "@/lib/db"

function isMissingColumn(error: unknown, fragment: string): boolean {
  const err = error as { code?: string; message?: string }
  return err?.code === "42703" && (err.message?.includes(fragment) ?? false)
}

/** Fetch a single quiz attempt result; tolerates missing deleted_at on older schemas. */
export async function getQuizAttemptResult(attemptId: string | number) {
  try {
    const result = await sql`
      SELECT
        qa.id as attempt_id,
        qa.quiz_id,
        qa.student_id,
        qa.score,
        qa.total_questions,
        qa.completed_at,
        EXTRACT(EPOCH FROM (qa.completed_at - qa.started_at))::integer as time_taken_seconds,
        s.full_name as student_name,
        s.student_id as student_number,
        s.section,
        q.title as quiz_title,
        q.assessment_type
      FROM quiz_attempts qa
      JOIN students s ON qa.student_id = s.id
      JOIN quizzes q ON qa.quiz_id = q.id
      WHERE qa.id = ${attemptId}
        AND qa.deleted_at IS NULL
    `
    return result
  } catch (error) {
    if (!isMissingColumn(error, "deleted_at")) throw error
    return sql`
      SELECT
        qa.id as attempt_id,
        qa.quiz_id,
        qa.student_id,
        qa.score,
        qa.total_questions,
        qa.completed_at,
        EXTRACT(EPOCH FROM (qa.completed_at - qa.started_at))::integer as time_taken_seconds,
        s.full_name as student_name,
        s.student_id as student_number,
        s.section,
        q.title as quiz_title,
        q.assessment_type
      FROM quiz_attempts qa
      JOIN students s ON qa.student_id = s.id
      JOIN quizzes q ON qa.quiz_id = q.id
      WHERE qa.id = ${attemptId}
    `
  }
}
