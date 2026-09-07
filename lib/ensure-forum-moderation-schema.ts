import { sql } from "@/lib/db"

let ensured = false

/** Idempotent columns for faculty forum moderation (instructor replies, pin, resolve). */
export async function ensureForumModerationSchema(): Promise<void> {
  if (ensured) return

  await sql`ALTER TABLE forum_replies ADD COLUMN IF NOT EXISTS instructor_id INTEGER REFERENCES instructors(id) ON DELETE SET NULL`
  await sql`ALTER TABLE forum_threads ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN NOT NULL DEFAULT false`
  await sql`ALTER TABLE forum_threads ADD COLUMN IF NOT EXISTS is_resolved BOOLEAN NOT NULL DEFAULT false`

  await sql`
    DO $$
    BEGIN
      ALTER TABLE forum_replies ALTER COLUMN student_id DROP NOT NULL;
    EXCEPTION
      WHEN others THEN NULL;
    END $$
  `

  ensured = true
}
