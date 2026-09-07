import { sql } from "@/lib/db"

let ensured = false

/** Ensure playground_results.completed_at exists as TIMESTAMPTZ. */
export async function ensurePlaygroundResultsSchema(): Promise<void> {
  if (ensured) return

  await sql`
    ALTER TABLE playground_results
    ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ
  `

  ensured = true
}
