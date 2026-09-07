import { sql } from "@/lib/db"

let ensured = false

export async function ensureFacultySignupColumns(): Promise<void> {
  if (ensured) return
  await sql`ALTER TABLE account_requests ADD COLUMN IF NOT EXISTS faculty_job_title VARCHAR(128)`
  await sql`ALTER TABLE account_requests ADD COLUMN IF NOT EXISTS faculty_password VARCHAR(255)`
  ensured = true
}
