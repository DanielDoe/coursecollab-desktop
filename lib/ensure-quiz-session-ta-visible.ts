import { sql } from "@/lib/db"

let ensured = false

export async function ensureQuizSessionTaVisibleColumn(): Promise<void> {
  if (ensured) return
  await sql`
    ALTER TABLE quiz_session_access
    ADD COLUMN IF NOT EXISTS ta_visible BOOLEAN NOT NULL DEFAULT false
  `
  ensured = true
}
