import { sql } from "@/lib/db"

let schemaReady = false

export async function ensureSyllabusExchangeSchema(): Promise<void> {
  if (schemaReady) return

  await sql`ALTER TABLE course_syllabi ADD COLUMN IF NOT EXISTS template_provenance JSONB`

  await sql`
    CREATE TABLE IF NOT EXISTS syllabus_exchange_copies (
      id SERIAL PRIMARY KEY,
      source_syllabus_id INTEGER NOT NULL REFERENCES course_syllabi(id) ON DELETE RESTRICT,
      destination_syllabus_id INTEGER NOT NULL REFERENCES course_syllabi(id) ON DELETE CASCADE,
      source_course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
      destination_course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
      source_instructor_id INTEGER NOT NULL REFERENCES instructors(id) ON DELETE RESTRICT,
      destination_instructor_id INTEGER NOT NULL REFERENCES instructors(id) ON DELETE RESTRICT,
      attribution JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`
    CREATE INDEX IF NOT EXISTS idx_syllabus_exchange_copies_destination
    ON syllabus_exchange_copies (destination_syllabus_id, created_at DESC)
  `
  await sql`
    CREATE INDEX IF NOT EXISTS idx_syllabus_exchange_copies_source
    ON syllabus_exchange_copies (source_syllabus_id, created_at DESC)
  `

  await sql`
    CREATE TABLE IF NOT EXISTS syllabus_exchange_access_log (
      id SERIAL PRIMARY KEY,
      source_syllabus_id INTEGER NOT NULL REFERENCES course_syllabi(id) ON DELETE CASCADE,
      destination_course_id INTEGER REFERENCES courses(id) ON DELETE SET NULL,
      destination_syllabus_id INTEGER REFERENCES course_syllabi(id) ON DELETE SET NULL,
      requester_instructor_id INTEGER NOT NULL REFERENCES instructors(id) ON DELETE CASCADE,
      source_instructor_id INTEGER NOT NULL REFERENCES instructors(id) ON DELETE CASCADE,
      copy_id INTEGER REFERENCES syllabus_exchange_copies(id) ON DELETE SET NULL,
      event_type TEXT NOT NULL,
      note TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`
    CREATE INDEX IF NOT EXISTS idx_syllabus_exchange_access_log_requester
    ON syllabus_exchange_access_log (requester_instructor_id, created_at DESC)
  `

  schemaReady = true
}
