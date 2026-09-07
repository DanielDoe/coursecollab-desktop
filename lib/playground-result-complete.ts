import { sql } from "@/lib/db"
import { ensurePlaygroundResultsSchema } from "@/lib/ensure-playground-results-schema"

type CompleteRow = { student_id: string | number; id: number }

function isMissingColumnError(error: unknown): boolean {
  const err = error as { code?: string; message?: string }
  return err?.code === "42703" || Boolean(err?.message?.includes("does not exist"))
}

function isNumericOverflowError(error: unknown): boolean {
  const err = error as { code?: string }
  return err?.code === "22003"
}

/**
 * Mark a playground result complete across deployments with varying completed_at column types.
 */
export async function markPlaygroundResultComplete(
  resultId: number,
  opts?: { byStudentId?: string },
): Promise<CompleteRow[]> {
  await ensurePlaygroundResultsSchema()

  const byIdVariants: Array<() => Promise<CompleteRow[]>> = [
    () =>
      sql`
        UPDATE playground_results
        SET completed_at = CURRENT_TIMESTAMP
        WHERE id = ${resultId}
          AND completed_at IS NULL
          AND questions_answered > 0
        RETURNING student_id, id
      ` as Promise<CompleteRow[]>,
    () =>
      sql`
        UPDATE playground_results
        SET completed_at = to_timestamp(EXTRACT(EPOCH FROM CURRENT_TIMESTAMP))
        WHERE id = ${resultId}
          AND completed_at IS NULL
          AND questions_answered > 0
        RETURNING student_id, id
      ` as Promise<CompleteRow[]>,
  ]

  const byStudentVariants: Array<() => Promise<CompleteRow[]>> = [
    () =>
      sql`
        UPDATE playground_results
        SET completed_at = CURRENT_TIMESTAMP
        WHERE student_id = ${opts!.byStudentId}
          AND questions_answered > 0
          AND completed_at IS NULL
        RETURNING student_id, id
      ` as Promise<CompleteRow[]>,
  ]

  const variants = opts?.byStudentId ? byStudentVariants : byIdVariants

  let lastError: unknown
  for (const run of variants) {
    try {
      return await run()
    } catch (error) {
      lastError = error
      if (isMissingColumnError(error)) return []
      if (isNumericOverflowError(error)) continue
      throw error
    }
  }

  if (lastError && isNumericOverflowError(lastError)) return []
  throw lastError
}
