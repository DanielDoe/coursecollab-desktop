import { sql } from "@/lib/db"

export async function ensureCodebenchLiveSnapshotsSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS codebench_live_snapshots (
      id bigserial PRIMARY KEY,
      student_id integer NOT NULL,
      assignment_id integer NOT NULL,
      course_id integer,
      language text,
      file_name text,
      code text NOT NULL DEFAULT '',
      typing_replay jsonb,
      updated_at timestamptz NOT NULL DEFAULT NOW(),
      UNIQUE (student_id, assignment_id)
    )
  `
  await sql`
    CREATE INDEX IF NOT EXISTS codebench_live_snapshots_assignment_idx
    ON codebench_live_snapshots (assignment_id, updated_at DESC)
  `
  try {
    await sql`ALTER TABLE codebench_live_snapshots ADD COLUMN IF NOT EXISTS instructor_code text`
    await sql`ALTER TABLE codebench_live_snapshots ADD COLUMN IF NOT EXISTS instructor_revision integer NOT NULL DEFAULT 0`
    await sql`ALTER TABLE codebench_live_snapshots ADD COLUMN IF NOT EXISTS instructor_updated_at timestamptz`
    await sql`ALTER TABLE codebench_live_snapshots ADD COLUMN IF NOT EXISTS student_cursor jsonb`
    await sql`ALTER TABLE codebench_live_snapshots ADD COLUMN IF NOT EXISTS instructor_cursor jsonb`
  } catch {
    /* columns may already exist or migration unavailable */
  }
}

export async function ensureCodebenchLiveSessionsSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS codebench_live_sessions (
      id bigserial PRIMARY KEY,
      assignment_id integer NOT NULL,
      course_id integer NOT NULL,
      instructor_id integer NOT NULL,
      started_at timestamptz NOT NULL DEFAULT NOW(),
      ended_at timestamptz
    )
  `
  try {
    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS codebench_live_sessions_open_assignment_idx
      ON codebench_live_sessions (assignment_id)
      WHERE ended_at IS NULL
    `
    await sql`
      CREATE INDEX IF NOT EXISTS codebench_live_sessions_course_open_idx
      ON codebench_live_sessions (course_id, started_at DESC)
      WHERE ended_at IS NULL
    `
  } catch (error) {
    console.error("[codebench_live_sessions] index ensure", error)
  }
}
