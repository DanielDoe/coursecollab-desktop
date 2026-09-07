import { sql } from "@/lib/db"

let schemaReady: Promise<void> | null = null

export async function ensureStudentProgressReviewsSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS student_progress_reviews (
          id SERIAL PRIMARY KEY,
          student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
          course_id INTEGER,
          instructor_id INTEGER,
          review_period TEXT NOT NULL DEFAULT 'midterm',
          progress_data JSONB NOT NULL DEFAULT '{}',
          review_sections JSONB NOT NULL DEFAULT '{}',
          content_markdown TEXT,
          model_used TEXT,
          email_sent_at TIMESTAMPTZ,
          announcement_id INTEGER,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `
      await sql`
        CREATE INDEX IF NOT EXISTS idx_student_progress_reviews_student
          ON student_progress_reviews (student_id, created_at DESC)
      `
      await sql`
        CREATE INDEX IF NOT EXISTS idx_student_progress_reviews_course
          ON student_progress_reviews (course_id, review_period)
      `

      await sql`
        ALTER TABLE student_progress_reviews
        ADD COLUMN IF NOT EXISTS as_of_date DATE
      `
      await sql`
        ALTER TABLE announcements
        ADD COLUMN IF NOT EXISTS target_student_id INTEGER REFERENCES students(id) ON DELETE CASCADE
      `
      await sql`
        CREATE INDEX IF NOT EXISTS idx_announcements_target_student
          ON announcements (target_student_id)
          WHERE target_student_id IS NOT NULL
      `
    })().catch((err) => {
      schemaReady = null
      throw err
    })
  }
  await schemaReady
}
