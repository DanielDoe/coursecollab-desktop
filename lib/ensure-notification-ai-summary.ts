import { sql } from "@/lib/db"

let ensured = false

/** Runtime guard so older deployments pick up ai_summary without a manual migration step. */
export async function ensureNotificationAiSummaryColumns() {
  if (ensured) return
  try {
    await sql`ALTER TABLE instructor_notifications ADD COLUMN IF NOT EXISTS ai_summary TEXT`
    await sql`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS ai_summary TEXT`
    ensured = true
  } catch (error) {
    console.warn("[Notifications] ensure ai_summary columns:", error)
  }
}
