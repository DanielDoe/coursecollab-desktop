import { sql } from "@/lib/db"

let ensured = false

export async function ensureDirectMessagesSchema() {
  if (ensured) return
  await sql`
    CREATE TABLE IF NOT EXISTS dm_threads (
      id SERIAL PRIMARY KEY,
      pair_key VARCHAR(128) NOT NULL UNIQUE,
      subject VARCHAR(500),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS dm_participants (
      thread_id INTEGER NOT NULL REFERENCES dm_threads(id) ON DELETE CASCADE,
      participant_kind VARCHAR(16) NOT NULL CHECK (participant_kind IN ('student', 'instructor')),
      participant_id INTEGER NOT NULL,
      last_read_at TIMESTAMPTZ,
      PRIMARY KEY (thread_id, participant_kind, participant_id)
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS dm_messages (
      id BIGSERIAL PRIMARY KEY,
      thread_id INTEGER NOT NULL REFERENCES dm_threads(id) ON DELETE CASCADE,
      sender_kind VARCHAR(16) NOT NULL CHECK (sender_kind IN ('student', 'instructor')),
      sender_id INTEGER NOT NULL,
      subject VARCHAR(500),
      body TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_dm_threads_updated ON dm_threads(updated_at DESC)`
  await sql`CREATE INDEX IF NOT EXISTS idx_dm_participants_actor ON dm_participants(participant_kind, participant_id)`
  await sql`CREATE INDEX IF NOT EXISTS idx_dm_messages_thread ON dm_messages(thread_id, created_at ASC)`
  await sql`
    CREATE TABLE IF NOT EXISTS dm_message_attachments (
      id BIGSERIAL PRIMARY KEY,
      message_id BIGINT NOT NULL REFERENCES dm_messages(id) ON DELETE CASCADE,
      file_name VARCHAR(255) NOT NULL,
      file_url TEXT NOT NULL,
      mime_type VARCHAR(128),
      file_size INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_dm_attachments_message ON dm_message_attachments(message_id)`
  await sql`
    DO $$
    BEGIN
      ALTER TABLE dm_message_attachments
        ALTER COLUMN file_url TYPE TEXT;
    EXCEPTION
      WHEN undefined_table THEN NULL;
      WHEN others THEN NULL;
    END $$
  `
  await sql`
    CREATE TABLE IF NOT EXISTS dm_message_upload_staging (
      id BIGSERIAL PRIMARY KEY,
      uploader_kind VARCHAR(16) NOT NULL CHECK (uploader_kind IN ('student', 'instructor')),
      uploader_id INTEGER NOT NULL,
      file_url TEXT NOT NULL UNIQUE,
      file_name VARCHAR(255) NOT NULL,
      mime_type VARCHAR(128),
      file_size INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      consumed_at TIMESTAMPTZ,
      message_id BIGINT REFERENCES dm_messages(id) ON DELETE SET NULL
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_dm_upload_staging_actor ON dm_message_upload_staging(uploader_kind, uploader_id, created_at DESC)`
  await sql`CREATE INDEX IF NOT EXISTS idx_dm_upload_staging_open ON dm_message_upload_staging(uploader_kind, uploader_id) WHERE consumed_at IS NULL`
  await sql`
    CREATE TABLE IF NOT EXISTS dm_message_reactions (
      id BIGSERIAL PRIMARY KEY,
      message_id BIGINT NOT NULL REFERENCES dm_messages(id) ON DELETE CASCADE,
      reactor_kind VARCHAR(16) NOT NULL CHECK (reactor_kind IN ('student', 'instructor')),
      reactor_id INTEGER NOT NULL,
      emoji VARCHAR(32) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (message_id, reactor_kind, reactor_id)
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_dm_reactions_message ON dm_message_reactions(message_id)`

  await sql`
    ALTER TABLE dm_messages
    ADD COLUMN IF NOT EXISTS unsent_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ
  `
  await sql`
    CREATE TABLE IF NOT EXISTS dm_message_edits (
      id BIGSERIAL PRIMARY KEY,
      message_id BIGINT NOT NULL REFERENCES dm_messages(id) ON DELETE CASCADE,
      body TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_dm_message_edits_message ON dm_message_edits(message_id, created_at ASC)`
  await sql`
    CREATE TABLE IF NOT EXISTS dm_message_hidden (
      message_id BIGINT NOT NULL REFERENCES dm_messages(id) ON DELETE CASCADE,
      participant_kind VARCHAR(16) NOT NULL CHECK (participant_kind IN ('student', 'instructor')),
      participant_id INTEGER NOT NULL,
      hidden_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (message_id, participant_kind, participant_id)
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_dm_message_hidden_actor ON dm_message_hidden(participant_kind, participant_id)`
  ensured = true
}
