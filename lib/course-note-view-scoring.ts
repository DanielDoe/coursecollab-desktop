import { sql } from "@/lib/db"

export async function ensureCourseNoteViewsSchema(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS course_note_views (
      id SERIAL PRIMARY KEY,
      note_id INTEGER NOT NULL REFERENCES course_digital_notes(id) ON DELETE CASCADE,
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      week_start_date DATE NOT NULL,
      viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (note_id, student_id, week_start_date)
    )
  `
  await sql`
    CREATE INDEX IF NOT EXISTS idx_course_note_views_student_week
    ON course_note_views (student_id, week_start_date)
  `
}

/** Idempotent: one counted read per note per student per trade week. */
export async function recordCourseNoteView(
  noteId: number,
  studentDbId: number,
  weekStartDate: string,
): Promise<boolean> {
  await ensureCourseNoteViewsSchema()
  const inserted = await sql`
    INSERT INTO course_note_views (note_id, student_id, week_start_date)
    VALUES (${noteId}, ${studentDbId}, ${weekStartDate}::date)
    ON CONFLICT (note_id, student_id, week_start_date) DO NOTHING
    RETURNING id
  `
  return Array.isArray(inserted) && inserted.length > 0
}

export async function countWeeklyCourseNoteReads(
  studentId: number,
  weekStartDate: string,
): Promise<number> {
  await ensureCourseNoteViewsSchema()
  const rows = await sql`
    SELECT COUNT(*)::int AS cnt
    FROM course_note_views
    WHERE student_id = ${studentId}
      AND week_start_date = ${weekStartDate}::date
  `
  return Number((rows[0] as { cnt: number })?.cnt) || 0
}
