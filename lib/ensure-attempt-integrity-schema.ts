import { sql } from "@/lib/db"

let ensured = false

/**
 * Attempt-integrity columns on quiz_attempts:
 * - deadline_at: server-authoritative sitting deadline (hard outer bound; NULL = untimed or
 *   clock paused via save-and-finish-later). Armed by the take route, enforced on writes.
 * - session_token: single-active-session token rotated on every take fetch. A stale token
 *   means another window/device took over the attempt.
 */
export async function ensureAttemptIntegritySchema(): Promise<void> {
  if (ensured) return
  await sql`
    ALTER TABLE quiz_attempts
    ADD COLUMN IF NOT EXISTS deadline_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS session_token TEXT
  `
  ensured = true
}
