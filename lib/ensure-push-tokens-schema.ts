import { sql } from "@/lib/db"

let ensured = false

export async function ensurePushTokensSchema() {
  if (ensured) return

  await sql`
    CREATE TABLE IF NOT EXISTS expo_push_tokens (
      id SERIAL PRIMARY KEY,
      owner_kind VARCHAR(16) NOT NULL CHECK (owner_kind IN ('student', 'instructor')),
      owner_id INTEGER NOT NULL,
      expo_push_token VARCHAR(255) NOT NULL,
      platform VARCHAR(16),
      device VARCHAR(32),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (owner_kind, owner_id, expo_push_token)
    )
  `
  await sql`
    CREATE INDEX IF NOT EXISTS idx_expo_push_tokens_owner
    ON expo_push_tokens(owner_kind, owner_id)
  `

  ensured = true
}
