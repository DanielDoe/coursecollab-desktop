import { sql } from "@/lib/db"

let ensured = false

/** Persist section-level countdown state on quiz_attempts (jsonb keyed by section index). */
export async function ensureSectionTimerSchema(): Promise<void> {
  if (ensured) return
  await sql`
    ALTER TABLE quiz_attempts
    ADD COLUMN IF NOT EXISTS section_time_remaining JSONB
  `
  ensured = true
}
