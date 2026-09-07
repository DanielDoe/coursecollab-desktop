import { sql } from "@/lib/db"

let ensured = false

export async function ensureCourseEvaluationSchema() {
  if (ensured) return

  await sql`
    CREATE TABLE IF NOT EXISTS course_evaluations (
      id SERIAL PRIMARY KEY,
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      session VARCHAR(32) NOT NULL,
      course_rating SMALLINT NOT NULL CHECK (course_rating >= 1 AND course_rating <= 5),
      improvement_suggestions TEXT,
      status VARCHAR(16) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('draft', 'pending', 'approved', 'rejected')),
      instructor_note TEXT,
      reviewed_by INTEGER,
      submitted_at TIMESTAMPTZ,
      reviewed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (student_id, session)
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS course_evaluation_proofs (
      id SERIAL PRIMARY KEY,
      evaluation_id INTEGER NOT NULL REFERENCES course_evaluations(id) ON DELETE CASCADE,
      url TEXT NOT NULL,
      file_name TEXT,
      mime TEXT,
      uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `

  await sql`
    CREATE INDEX IF NOT EXISTS idx_course_evaluations_status
    ON course_evaluations(status, session)
  `

  await sql`
    ALTER TABLE course_evaluations
    ADD COLUMN IF NOT EXISTS self_assessed_letter_grade VARCHAR(3)
  `

  await sql`
    ALTER TABLE course_evaluations
    ADD COLUMN IF NOT EXISTS platform_helpfulness SMALLINT
  `
  await sql`
    ALTER TABLE course_evaluations
    ADD COLUMN IF NOT EXISTS favorite_features JSONB NOT NULL DEFAULT '[]'::jsonb
  `
  await sql`
    ALTER TABLE course_evaluations
    ADD COLUMN IF NOT EXISTS feature_to_improve VARCHAR(64)
  `
  await sql`
    ALTER TABLE course_evaluations
    ADD COLUMN IF NOT EXISTS instructor_clarity SMALLINT
  `
  await sql`
    ALTER TABLE course_evaluations
    ADD COLUMN IF NOT EXISTS workload VARCHAR(32)
  `
  await sql`
    ALTER TABLE course_evaluations
    ADD COLUMN IF NOT EXISTS ai_tutor_usage VARCHAR(32)
  `
  await sql`
    ALTER TABLE course_evaluations
    ADD COLUMN IF NOT EXISTS nps_score SMALLINT
  `
  await sql`
    ALTER TABLE course_evaluations
    ADD COLUMN IF NOT EXISTS missing_features TEXT
  `

  await sql`
    ALTER TABLE course_evaluations
    ADD COLUMN IF NOT EXISTS favorite_features_other TEXT
  `
  await sql`
    ALTER TABLE course_evaluations
    ADD COLUMN IF NOT EXISTS feature_to_improve_other TEXT
  `

  await sql`
    ALTER TABLE course_evaluations
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  `
  await sql`
    ALTER TABLE course_evaluations
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  `
  await sql`
    ALTER TABLE course_evaluations
    ADD COLUMN IF NOT EXISTS session VARCHAR(64)
  `

  ensured = true
}
