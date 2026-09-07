import { sql } from "@/lib/db"

let ensured = false

export async function ensureResultsFinalizedColumns(): Promise<void> {
  if (ensured) return
  await sql`ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS results_finalized_at TIMESTAMPTZ`
  await sql`ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS results_finalized_by TEXT`
  ensured = true
}
