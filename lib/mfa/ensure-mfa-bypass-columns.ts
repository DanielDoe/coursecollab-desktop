import { sql } from "@/lib/db"

let ensured = false

export async function ensureMfaBypassColumns() {
  if (ensured) return

  await sql`
    ALTER TABLE instructors
    ADD COLUMN IF NOT EXISTS mfa_bypass BOOLEAN NOT NULL DEFAULT false
  `
  await sql`
    ALTER TABLE students
    ADD COLUMN IF NOT EXISTS mfa_bypass BOOLEAN NOT NULL DEFAULT false
  `

  ensured = true
}
