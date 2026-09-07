/**
 * Shared personal digital note create — used by Cora confirm and study-note helpers.
 */

import { sql } from "@/lib/db"

async function ensureDigitalNotesSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS student_digital_notes (
      id SERIAL PRIMARY KEY,
      student_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      body_text TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
}

export async function createStudentDigitalNote(input: {
  studentDbId: number
  title: string
  bodyText: string
}): Promise<{ noteId: number; title: string; href: string }> {
  await ensureDigitalNotesSchema()
  const title = String(input.title ?? "").trim() || "Untitled note"
  const bodyText = String(input.bodyText ?? "")
  const rows = await sql`
    INSERT INTO student_digital_notes (student_id, title, body_text)
    VALUES (${input.studentDbId}, ${title.slice(0, 200)}, ${bodyText})
    RETURNING id, title
  `
  const note = rows[0] as { id: number; title: string }
  if (!note) throw new Error("Could not create note.")
  return {
    noteId: Number(note.id),
    title: note.title,
    href: `/module/notes`,
  }
}
