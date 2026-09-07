import { sql } from "@/lib/db"

let ensured = false

export async function ensureAnnouncementAiSummaryColumn(): Promise<void> {
  if (ensured) return
  await sql`
    ALTER TABLE announcements
    ADD COLUMN IF NOT EXISTS ai_summary TEXT
  `
  ensured = true
}
