import { sql } from "@/lib/db"

let ensured = false

export async function ensureAnnouncementComposerColumns(): Promise<void> {
  if (ensured) return
  await sql`
    ALTER TABLE announcements
    ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'info'
  `
  await sql`
    ALTER TABLE announcements
    ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium'
  `
  await sql`
    ALTER TABLE announcements
    ADD COLUMN IF NOT EXISTS target_session TEXT DEFAULT 'all'
  `
  await sql`
    ALTER TABLE announcements
    ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ
  `
  await sql`
    ALTER TABLE announcements
    ADD COLUMN IF NOT EXISTS event_date DATE
  `
  await sql`
    ALTER TABLE announcements
    ADD COLUMN IF NOT EXISTS event_time TEXT
  `
  await sql`
    ALTER TABLE announcements
    ADD COLUMN IF NOT EXISTS event_end TEXT
  `
  await sql`
    ALTER TABLE announcements
    ADD COLUMN IF NOT EXISTS event_location TEXT
  `
  ensured = true
}
