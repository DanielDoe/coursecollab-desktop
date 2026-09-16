import { sql } from "@/lib/db"

let ensured = false

export async function ensureQuizPlatformAccessColumn(): Promise<void> {
  if (ensured) return
  await sql`
    ALTER TABLE quizzes
    ADD COLUMN IF NOT EXISTS platform_access JSONB
  `
  ensured = true
}
