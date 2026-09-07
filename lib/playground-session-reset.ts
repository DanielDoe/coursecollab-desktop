import { sql } from "@/lib/db"
import { countPlaygroundRows } from "@/lib/playground-delete-audit"

export type PlaygroundSessionClearResult = {
  rowsBefore: { answers: number; results: number; questions: number; sessions: number }
  deletedAnswers: number
  deletedResults: number
  remainingResults: number
  remainingAnswers: number
}

/** Removes stale waiting-room rows only — preserves completed and in-progress game attempts. */
export async function clearPlaygroundWaitingRoomAttempts(
  sessionId: number,
): Promise<PlaygroundSessionClearResult> {
  const rowsBefore = await countPlaygroundRows({ sessionId })

  await sql`
    DELETE FROM playground_answers pa
    USING playground_results pr
    WHERE pa.result_id = pr.id
      AND pr.session_id = ${sessionId}
      AND pr.joined_at_question < 0
      AND pr.completed_at IS NULL
  `
  const deletedResults = await sql`
    DELETE FROM playground_results pr
    WHERE pr.session_id = ${sessionId}
      AND pr.joined_at_question < 0
      AND pr.completed_at IS NULL
    RETURNING pr.id
  `

  const rowsAfter = await countPlaygroundRows({ sessionId })
  const deletedResultCount = Array.isArray(deletedResults) ? deletedResults.length : 0

  return {
    rowsBefore,
    deletedAnswers: Math.max(0, rowsBefore.answers - rowsAfter.answers),
    deletedResults: deletedResultCount,
    remainingResults: rowsAfter.results,
    remainingAnswers: rowsAfter.answers,
  }
}

/** Deletes all student attempts (results + answers) for one classroom session. */
export async function clearPlaygroundSessionAttempts(
  sessionId: number,
): Promise<PlaygroundSessionClearResult> {
  const rowsBefore = await countPlaygroundRows({ sessionId })

  await sql`
    DELETE FROM playground_answers pa
    USING playground_results pr
    WHERE pa.result_id = pr.id AND pr.session_id = ${sessionId}
  `
  await sql`DELETE FROM playground_results WHERE session_id = ${sessionId}`
  await sql`
    UPDATE playground_sessions
    SET current_question_index = 0
    WHERE id = ${sessionId}
  `

  const rowsAfter = await countPlaygroundRows({ sessionId })

  return {
    rowsBefore,
    deletedAnswers: rowsBefore.answers,
    deletedResults: rowsBefore.results,
    remainingResults: rowsAfter.results,
    remainingAnswers: rowsAfter.answers,
  }
}
