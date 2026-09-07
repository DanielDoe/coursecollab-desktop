import { sql } from "@/lib/db"

let ensured = false

export async function ensureAnnouncementStudentContentLockedColumn(): Promise<void> {
  if (ensured) return
  await sql`
    ALTER TABLE announcements
    ADD COLUMN IF NOT EXISTS student_content_locked BOOLEAN NOT NULL DEFAULT false
  `
  ensured = true
}
