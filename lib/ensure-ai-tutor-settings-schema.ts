import { sql } from "@/lib/db"

let ensured = false

/** Ensure ai_tutor_settings exists for instructor course policy (Cora / mobile settings). */
export async function ensureAiTutorSettingsSchema(): Promise<void> {
  if (ensured) return

  await sql`
    CREATE TABLE IF NOT EXISTS ai_tutor_settings (
      id SERIAL PRIMARY KEY,
      instructor_id VARCHAR(64) NOT NULL,
      course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      enable_ai_tutor BOOLEAN NOT NULL DEFAULT true,
      allow_code_debugging BOOLEAN NOT NULL DEFAULT true,
      allow_practice_generation BOOLEAN NOT NULL DEFAULT true,
      max_response_length INTEGER NOT NULL DEFAULT 500,
      response_style VARCHAR(32) NOT NULL DEFAULT 'helpful',
      ai_model VARCHAR(64) NOT NULL DEFAULT 'auto',
      enable_hints BOOLEAN NOT NULL DEFAULT true,
      enable_step_by_step BOOLEAN NOT NULL DEFAULT true,
      enable_code_examples BOOLEAN NOT NULL DEFAULT true,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `

  await sql`ALTER TABLE ai_tutor_settings ADD COLUMN IF NOT EXISTS course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE`
  await sql`ALTER TABLE ai_tutor_settings ADD COLUMN IF NOT EXISTS enable_ai_tutor BOOLEAN NOT NULL DEFAULT true`
  await sql`ALTER TABLE ai_tutor_settings ADD COLUMN IF NOT EXISTS allow_code_debugging BOOLEAN NOT NULL DEFAULT true`
  await sql`ALTER TABLE ai_tutor_settings ADD COLUMN IF NOT EXISTS allow_practice_generation BOOLEAN NOT NULL DEFAULT true`
  await sql`ALTER TABLE ai_tutor_settings ADD COLUMN IF NOT EXISTS max_response_length INTEGER NOT NULL DEFAULT 500`
  await sql`ALTER TABLE ai_tutor_settings ADD COLUMN IF NOT EXISTS response_style VARCHAR(32) NOT NULL DEFAULT 'helpful'`
  await sql`ALTER TABLE ai_tutor_settings ADD COLUMN IF NOT EXISTS ai_model VARCHAR(64) NOT NULL DEFAULT 'auto'`
  await sql`ALTER TABLE ai_tutor_settings ADD COLUMN IF NOT EXISTS enable_hints BOOLEAN NOT NULL DEFAULT true`
  await sql`ALTER TABLE ai_tutor_settings ADD COLUMN IF NOT EXISTS enable_step_by_step BOOLEAN NOT NULL DEFAULT true`
  await sql`ALTER TABLE ai_tutor_settings ADD COLUMN IF NOT EXISTS enable_code_examples BOOLEAN NOT NULL DEFAULT true`
  await sql`ALTER TABLE ai_tutor_settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

  await sql`ALTER TABLE ai_tutor_settings DROP CONSTRAINT IF EXISTS ai_tutor_settings_instructor_id_key`
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS ai_tutor_settings_instructor_course_uniq
    ON ai_tutor_settings (instructor_id, course_id)
  `

  ensured = true
}
