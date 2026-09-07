import { sql } from "@/lib/db"

export type PracticeAttemptRow = {
  id: number
  student_id?: string | number
  started_at?: Date | string | null
  created_at?: Date | string | null
  correct_answers?: number | null
  total_questions?: number | null
}

function isMissingColumnError(error: unknown): boolean {
  const err = error as { code?: string }
  return err?.code === "42703"
}

type QueryRunner = () => Promise<PracticeAttemptRow[]>

function loadVariants(attemptId: number, studentId?: string | number): QueryRunner[] {
  if (studentId != null) {
    return [
      () =>
        sql`
          SELECT id, student_id, started_at, created_at, correct_answers, total_questions
          FROM practice_attempts
          WHERE id = ${attemptId} AND student_id = ${studentId}
        `,
      () =>
        sql`
          SELECT id, student_id, started_at, correct_answers, total_questions
          FROM practice_attempts
          WHERE id = ${attemptId} AND student_id = ${studentId}
        `,
      () =>
        sql`
          SELECT id, student_id, started_at
          FROM practice_attempts
          WHERE id = ${attemptId} AND student_id = ${studentId}
        `,
      () =>
        sql`
          SELECT id, started_at
          FROM practice_attempts
          WHERE id = ${attemptId} AND student_id = ${studentId}
        `,
    ]
  }

  return [
    () =>
      sql`
        SELECT id, student_id, started_at, created_at, correct_answers, total_questions
        FROM practice_attempts
        WHERE id = ${attemptId}
      `,
    () =>
      sql`
        SELECT id, student_id, started_at, correct_answers, total_questions
        FROM practice_attempts
        WHERE id = ${attemptId}
      `,
    () =>
      sql`
        SELECT id, student_id, started_at
        FROM practice_attempts
        WHERE id = ${attemptId}
      `,
    () =>
      sql`
        SELECT id, started_at
        FROM practice_attempts
        WHERE id = ${attemptId}
      `,
  ]
}

/** Load a practice attempt with schema-safe column fallbacks. */
export async function loadPracticeAttemptById(
  attemptId: number,
  studentId?: string | number,
): Promise<PracticeAttemptRow | null> {
  const variants = loadVariants(attemptId, studentId)

  let lastError: unknown
  for (const run of variants) {
    try {
      const rows = await run()
      return rows[0] ?? null
    } catch (error) {
      lastError = error
      if (!isMissingColumnError(error)) throw error
    }
  }

  throw lastError
}

/** Minimal load for complete routes (started_at / created_at only). */
export async function loadPracticeAttemptTiming(attemptId: number): Promise<PracticeAttemptRow | null> {
  const variants: Array<() => Promise<PracticeAttemptRow[]>> = [
    () =>
      sql`
        SELECT id, started_at, created_at
        FROM practice_attempts
        WHERE id = ${attemptId}
      `,
    () =>
      sql`
        SELECT id, started_at
        FROM practice_attempts
        WHERE id = ${attemptId}
      `,
    () =>
      sql`
        SELECT id
        FROM practice_attempts
        WHERE id = ${attemptId}
      `,
  ]

  let lastError: unknown
  for (const run of variants) {
    try {
      const rows = await run()
      return rows[0] ?? null
    } catch (error) {
      lastError = error
      if (!isMissingColumnError(error)) throw error
    }
  }

  throw lastError
}
