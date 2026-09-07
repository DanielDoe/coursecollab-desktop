import { sql } from "@/lib/db"

let ensured = false

export async function ensureUserTimezoneSchema() {
  if (ensured) return
  await sql`ALTER TABLE students ADD COLUMN IF NOT EXISTS timezone VARCHAR(64)`
  await sql`ALTER TABLE instructors ADD COLUMN IF NOT EXISTS timezone VARCHAR(64)`
  await sql`ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS timezone VARCHAR(64)`
  ensured = true
}
