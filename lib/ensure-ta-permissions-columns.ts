import { sql } from "@/lib/db"

let ensured = false

export async function ensureTaPermissionColumns(): Promise<void> {
  if (ensured) return
  await sql`ALTER TABLE instructors ADD COLUMN IF NOT EXISTS ta_level VARCHAR(16) NOT NULL DEFAULT 'ta'`
  await sql`ALTER TABLE instructors ADD COLUMN IF NOT EXISTS ta_permissions JSONB NOT NULL DEFAULT '{}'::jsonb`
  ensured = true
}
