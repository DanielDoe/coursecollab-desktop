import { sql } from "@/lib/db"

function isMissingColumnError(error: unknown): boolean {
  const err = error as { code?: string }
  return err?.code === "42703"
}

/** Generated columns (e.g. score_percentage) cannot be written directly. */
function isGeneratedColumnError(error: unknown): boolean {
  const err = error as { code?: string }
  return err?.code === "428C9"
}

function isRecoverableSchemaError(error: unknown): boolean {
  return isMissingColumnError(error) || isGeneratedColumnError(error)
}

/**
 * Finalize a practice attempt across deployments with varying practice_attempts columns.
 * Does not write score_percentage when it is a generated column — only correct_answers.
 */
export async function finalizePracticeAttempt(opts: {
  attemptId: number
  correctCount: number
  score: number
  startedAt: Date | string
}): Promise<void> {
  const { attemptId, correctCount, score, startedAt } = opts
  const startedIso =
    startedAt instanceof Date ? startedAt.toISOString() : String(startedAt)

  const variants: Array<() => Promise<unknown>> = [
    () =>
      sql`
        UPDATE practice_attempts
        SET
          correct_answers = ${correctCount},
          completed_at = NOW(),
          time_spent_seconds = EXTRACT(EPOCH FROM (NOW() - ${startedIso}::timestamptz))::INTEGER
        WHERE id = ${attemptId}
      `,
    () =>
      sql`
        UPDATE practice_attempts
        SET correct_answers = ${correctCount}, completed_at = NOW()
        WHERE id = ${attemptId}
      `,
    () =>
      sql`
        UPDATE practice_attempts
        SET
          correct_answers = ${correctCount},
          score_percentage = ${score},
          completed_at = NOW()
        WHERE id = ${attemptId}
      `,
    () =>
      sql`
        UPDATE practice_attempts
        SET score = ${score}, completed_at = NOW()
        WHERE id = ${attemptId}
      `,
    () =>
      sql`
        UPDATE practice_attempts
        SET completed_at = NOW()
        WHERE id = ${attemptId}
      `,
  ]

  let lastError: unknown
  for (const run of variants) {
    try {
      await run()
      return
    } catch (error) {
      lastError = error
      if (!isRecoverableSchemaError(error)) throw error
    }
  }

  throw lastError
}
