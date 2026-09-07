import { sql } from "@/lib/db"

let ensured = false

/** Adds instructor ownership on summer_camps for faculty-created programs. */
export async function ensureSummerCampInstructorColumns(): Promise<void> {
  if (ensured) return
  await sql`
    ALTER TABLE summer_camps
    ADD COLUMN IF NOT EXISTS instructor_id INTEGER REFERENCES instructors(id) ON DELETE SET NULL
  `
  await sql`
    CREATE INDEX IF NOT EXISTS idx_summer_camps_instructor ON summer_camps(instructor_id)
  `
  ensured = true
}
