import { sql } from "@/lib/db"

let ensured = false

/** Institution / title / contact fields on faculty accounts (idempotent). */
export async function ensureInstructorProfileColumns(): Promise<void> {
  if (ensured) return
  await sql`ALTER TABLE instructors ADD COLUMN IF NOT EXISTS institution VARCHAR(255)`
  await sql`ALTER TABLE instructors ADD COLUMN IF NOT EXISTS job_title VARCHAR(128)`
  await sql`ALTER TABLE instructors ADD COLUMN IF NOT EXISTS phone VARCHAR(64)`
  await sql`ALTER TABLE instructors ADD COLUMN IF NOT EXISTS office VARCHAR(128)`
  ensured = true
}
