import { sql } from "@/lib/db"

export const PLAYGROUND_SESSION_ENDED_MESSAGE =
  "This session has ended. Return to the playground lobby."

export type PlaygroundSessionState = {
  id: number
  mode: string
  is_active: boolean
}

export async function getPlaygroundSessionById(
  sessionId: number,
): Promise<PlaygroundSessionState | null> {
  const rows = await sql`
    SELECT id, mode, is_active
    FROM playground_sessions
    WHERE id = ${sessionId}
    LIMIT 1
  `
  return (rows[0] as PlaygroundSessionState | undefined) ?? null
}

export async function getPlaygroundSessionByResultId(
  resultId: number,
): Promise<PlaygroundSessionState | null> {
  const rows = await sql`
    SELECT ps.id, ps.mode, ps.is_active
    FROM playground_results pr
    JOIN playground_sessions ps ON ps.id = pr.session_id
    WHERE pr.id = ${resultId}
    LIMIT 1
  `
  return (rows[0] as PlaygroundSessionState | undefined) ?? null
}

export function isClassroomSessionEnded(session: PlaygroundSessionState): boolean {
  return session.mode === "CLASSROOM" && !session.is_active
}
