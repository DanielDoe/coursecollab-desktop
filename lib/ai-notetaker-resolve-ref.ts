import { sql } from "@/lib/db"
import { makeNotePublicSlug } from "@/lib/ai-notetaker-slug"
import { notetakerSlugColumnExists } from "@/lib/ai-notetaker-slug-column"

/** Resolve URL segment (numeric id or public slug) to the note's database id for this student. */
export async function resolveNotetakerNoteDatabaseId(
  ref: string,
  studentId: number,
): Promise<number | null> {
  const r = ref.trim()
  if (!r) return null
  if (/^\d+$/.test(r)) {
    const rows = await sql`
      SELECT id FROM student_ai_notetaker_notes
      WHERE id = ${parseInt(r, 10)} AND student_id = ${studentId}
      LIMIT 1
    `
    const row = rows[0] as { id: number } | undefined
    return row ? Number(row.id) : null
  }

  if (await notetakerSlugColumnExists()) {
    const rows = await sql`
      SELECT id FROM student_ai_notetaker_notes
      WHERE slug = ${r} AND student_id = ${studentId}
      LIMIT 1
    `
    const row = rows[0] as { id: number } | undefined
    if (row) return Number(row.id)
  }

  const m = r.match(/-(\d+)$/)
  if (!m) return null
  const id = parseInt(m[1], 10)
  if (!Number.isFinite(id)) return null
  const rows = await sql`
    SELECT id, title FROM student_ai_notetaker_notes
    WHERE id = ${id} AND student_id = ${studentId}
    LIMIT 1
  `
  const row = rows[0] as { id: number; title: string } | undefined
  if (!row) return null
  if (r === `lecture-${id}`) return id
  if (makeNotePublicSlug(String(row.title), id) === r) return id
  return null
}
