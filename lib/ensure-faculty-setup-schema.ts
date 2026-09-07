import { sql } from "@/lib/db"

let ensured = false

export async function ensureFacultySetupSchema(): Promise<void> {
  if (ensured) return
  await sql`ALTER TABLE instructors ADD COLUMN IF NOT EXISTS faculty_setup_completed_at TIMESTAMPTZ`
  await sql`ALTER TABLE instructors ADD COLUMN IF NOT EXISTS setup_metadata JSONB NOT NULL DEFAULT '{}'::jsonb`
  ensured = true
}
