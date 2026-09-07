import { sql } from "@/lib/db"

let ensured = false

export async function ensureSyllabusSchema(): Promise<void> {
  if (ensured) return

  await sql`
    CREATE TABLE IF NOT EXISTS course_syllabi (
      id SERIAL PRIMARY KEY,
      course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      session_id INTEGER REFERENCES sessions(id) ON DELETE CASCADE,
      title VARCHAR(500) NOT NULL DEFAULT 'Course Syllabus',
      term VARCHAR(120) NOT NULL DEFAULT '',
      status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
      sections JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_by INTEGER REFERENCES instructors(id) ON DELETE SET NULL,
      updated_by INTEGER REFERENCES instructors(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      published_at TIMESTAMPTZ
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_course_syllabi_course_id ON course_syllabi(course_id)`
  await sql`CREATE INDEX IF NOT EXISTS idx_course_syllabi_status ON course_syllabi(status)`

  await sql`ALTER TABLE course_syllabi ADD COLUMN IF NOT EXISTS content_mode VARCHAR(20) NOT NULL DEFAULT 'structured'`
  await sql`ALTER TABLE course_syllabi ADD COLUMN IF NOT EXISTS pdf_url TEXT`
  await sql`ALTER TABLE course_syllabi ADD COLUMN IF NOT EXISTS pdf_file_name VARCHAR(500)`
  await sql`ALTER TABLE course_syllabi ADD COLUMN IF NOT EXISTS logo_url TEXT`
  await sql`ALTER TABLE course_syllabi ADD COLUMN IF NOT EXISTS logo_file_name VARCHAR(500)`
  await sql`ALTER TABLE course_syllabi ADD COLUMN IF NOT EXISTS session_id INTEGER REFERENCES sessions(id) ON DELETE CASCADE`
  await sql`ALTER TABLE course_syllabi ADD COLUMN IF NOT EXISTS template_provenance JSONB`

  await sql`
    DO $$
    BEGIN
      ALTER TABLE course_syllabi DROP CONSTRAINT IF EXISTS course_syllabi_course_id_key;
    EXCEPTION
      WHEN undefined_object THEN NULL;
    END $$
  `
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_course_syllabi_course_session_unique
    ON course_syllabi (course_id, COALESCE(session_id, 0))
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_course_syllabi_session_id ON course_syllabi(session_id)`

  await sql`
    CREATE TABLE IF NOT EXISTS syllabus_views (
      id SERIAL PRIMARY KEY,
      syllabus_id INTEGER NOT NULL REFERENCES course_syllabi(id) ON DELETE CASCADE,
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      syllabus_revision TIMESTAMPTZ NOT NULL,
      points_awarded NUMERIC(6,2) NOT NULL DEFAULT 0,
      viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (syllabus_id, student_id, syllabus_revision)
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_syllabus_views_student ON syllabus_views(student_id)`

  await sql`
    INSERT INTO permissions (code, description) VALUES
      ('manage_syllabus', 'Create, edit, and publish course syllabi')
    ON CONFLICT (code) DO NOTHING
  `
  await sql`
    INSERT INTO role_permissions (role, permission_code) VALUES
      ('INSTRUCTOR', 'manage_syllabus')
    ON CONFLICT (role, permission_code) DO NOTHING
  `

  ensured = true
}
