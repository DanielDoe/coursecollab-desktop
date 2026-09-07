import { sql } from "@/lib/db"

/** Only cache positive detection so a deploy can pick up the column after migration without restart. */
let slugColumnKnownPresent = false

/** True when `student_ai_notetaker_notes.slug` exists (migration applied). */
export async function notetakerSlugColumnExists(): Promise<boolean> {
  if (slugColumnKnownPresent) return true
  const rows = await sql`
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'student_ai_notetaker_notes'
      AND column_name = 'slug'
    LIMIT 1
  `
  const list = Array.isArray(rows) ? rows : []
  if (list.length > 0) slugColumnKnownPresent = true
  return slugColumnKnownPresent
}
