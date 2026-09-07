import { sql } from "@/lib/db"

export async function ensureCodebenchStudioEventsSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS codebench_studio_events (
      id bigserial PRIMARY KEY,
      student_id integer NOT NULL,
      course_id integer,
      event_type text NOT NULL,
      language text,
      error_family text,
      error_message text,
      tool text,
      file_name text,
      success boolean,
      created_at timestamptz NOT NULL DEFAULT NOW()
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS codebench_studio_events_student_idx ON codebench_studio_events (student_id, created_at DESC)`
  await sql`CREATE INDEX IF NOT EXISTS codebench_studio_events_course_idx ON codebench_studio_events (course_id, created_at DESC)`
}
