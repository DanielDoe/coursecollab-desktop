import { sql } from "@/lib/db"

export async function savePracticeAnswerRecord(opts: {
  attemptId: number
  questionId: number
  answer: unknown
  isCorrect: boolean
  responseTimeMs?: number | null
  xpEarned?: number | null
  difficulty?: string | null
}): Promise<void> {
  const {
    attemptId,
    questionId,
    answer,
    isCorrect,
    responseTimeMs = null,
    xpEarned = 0,
    difficulty = null,
  } = opts

  const [attemptRow] = await sql`
    SELECT id FROM practice_attempts WHERE id = ${attemptId} LIMIT 1
  `
  if (!attemptRow) {
    throw new Error(`Practice attempt ${attemptId} not found`)
  }

  const answerJson =
    typeof answer === "string" ? answer : JSON.stringify(answer ?? "")

  const existingAnswer = await sql`
    SELECT id FROM practice_answers
    WHERE attempt_id = ${attemptId} AND bank_question_id = ${questionId}
  `

  if (existingAnswer.length > 0) {
    await sql`
      UPDATE practice_answers
      SET
        student_answer = ${answerJson},
        is_correct = ${isCorrect},
        response_time_ms = ${responseTimeMs},
        xp_earned = ${xpEarned ?? 0},
        difficulty = ${difficulty},
        answered_at = NOW()
      WHERE attempt_id = ${attemptId} AND bank_question_id = ${questionId}
    `
  } else {
    await sql`
      INSERT INTO practice_answers (
        attempt_id,
        bank_question_id,
        student_answer,
        is_correct,
        response_time_ms,
        xp_earned,
        difficulty,
        answered_at
      ) VALUES (
        ${attemptId},
        ${questionId},
        ${answerJson},
        ${isCorrect},
        ${responseTimeMs},
        ${xpEarned ?? 0},
        ${difficulty},
        NOW()
      )
    `
  }
}

/** Normalize practice_answers.student_answer from TEXT or JSONB. */
export function normalizePracticeStudentAnswer(raw: unknown): unknown {
  if (raw == null) return ""
  if (typeof raw === "string") {
    const trimmed = raw.trim()
    if (!trimmed) return ""
    if (trimmed.startsWith("[") || trimmed.startsWith("{") || trimmed.startsWith('"')) {
      try {
        return JSON.parse(trimmed)
      } catch {
        return raw
      }
    }
    return raw
  }
  return raw
}
