import { sql } from "@/lib/db"

let ensured = false

export async function ensurePresenceSchema() {
  if (ensured) return
  await sql`
    CREATE TABLE IF NOT EXISTS user_presence (
      participant_kind VARCHAR(16) NOT NULL CHECK (participant_kind IN ('student', 'instructor')),
      participant_id INTEGER NOT NULL,
      manual_status VARCHAR(32) CHECK (
        manual_status IS NULL OR manual_status IN ('available', 'busy', 'dnd', 'away', 'appear_offline')
      ),
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (participant_kind, participant_id)
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_user_presence_last_seen ON user_presence(last_seen_at DESC)`
  ensured = true
}
