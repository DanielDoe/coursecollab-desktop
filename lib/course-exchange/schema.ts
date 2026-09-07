import { sql } from "@/lib/db"

let schemaReady = false

/** Idempotent schema ensure for dev/preview without migration runner. */
export async function ensureCourseExchangeSchema(): Promise<void> {
  if (schemaReady) return
  await sql`
    CREATE TABLE IF NOT EXISTS course_exchange_settings (
      course_id INTEGER PRIMARY KEY REFERENCES courses(id) ON DELETE CASCADE,
      sharing_mode TEXT NOT NULL DEFAULT 'off' CHECK (sharing_mode IN ('off', 'request_only')),
      discoverable_title TEXT,
      discoverable_description TEXT,
      shareable_modules JSONB NOT NULL DEFAULT '[]'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_by INTEGER REFERENCES instructors(id) ON DELETE SET NULL
    )
  `
  await sql`ALTER TABLE course_exchange_settings ADD COLUMN IF NOT EXISTS shareable_modules JSONB NOT NULL DEFAULT '[]'::jsonb`
  await sql`ALTER TABLE course_exchange_settings ADD COLUMN IF NOT EXISTS auto_approve BOOLEAN NOT NULL DEFAULT false`
  await sql`
    CREATE TABLE IF NOT EXISTS course_exchange_requests (
      id SERIAL PRIMARY KEY,
      source_course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      source_instructor_id INTEGER NOT NULL REFERENCES instructors(id) ON DELETE CASCADE,
      requester_instructor_id INTEGER NOT NULL REFERENCES instructors(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'PENDING',
      purpose TEXT,
      requester_institution TEXT,
      requester_department TEXT,
      requested_modules JSONB NOT NULL DEFAULT '[]'::jsonb,
      approved_modules JSONB,
      destination_course_id INTEGER REFERENCES courses(id) ON DELETE SET NULL,
      destination_session_id INTEGER REFERENCES sessions(id) ON DELETE SET NULL,
      clone_summary JSONB,
      clone_error TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      reviewed_at TIMESTAMPTZ,
      reviewed_by INTEGER REFERENCES instructors(id) ON DELETE SET NULL,
      completed_at TIMESTAMPTZ,
      rejected_at TIMESTAMPTZ,
      rejection_reason TEXT,
      cancelled_at TIMESTAMPTZ
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS course_exchange_copies (
      id SERIAL PRIMARY KEY,
      request_id INTEGER NOT NULL UNIQUE REFERENCES course_exchange_requests(id) ON DELETE CASCADE,
      source_course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
      destination_course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
      source_instructor_id INTEGER NOT NULL REFERENCES instructors(id) ON DELETE RESTRICT,
      destination_instructor_id INTEGER NOT NULL REFERENCES instructors(id) ON DELETE RESTRICT,
      approved_modules JSONB NOT NULL DEFAULT '[]'::jsonb,
      attribution JSONB NOT NULL DEFAULT '{}'::jsonb,
      clone_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS course_exchange_access_log (
      id SERIAL PRIMARY KEY,
      course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      source_instructor_id INTEGER NOT NULL REFERENCES instructors(id) ON DELETE CASCADE,
      requester_instructor_id INTEGER NOT NULL REFERENCES instructors(id) ON DELETE CASCADE,
      request_id INTEGER REFERENCES course_exchange_requests(id) ON DELETE SET NULL,
      event_type TEXT NOT NULL,
      modules JSONB NOT NULL DEFAULT '[]'::jsonb,
      auto_approved BOOLEAN NOT NULL DEFAULT false,
      note TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`
    CREATE INDEX IF NOT EXISTS idx_course_exchange_access_log_source
    ON course_exchange_access_log (source_instructor_id, created_at DESC)
  `
  await sql`
    CREATE INDEX IF NOT EXISTS idx_course_exchange_access_log_request
    ON course_exchange_access_log (request_id, created_at ASC)
  `
  await sql`ALTER TABLE courses ADD COLUMN IF NOT EXISTS exchange_provenance JSONB`
  await sql`ALTER TABLE course_exchange_copies ADD COLUMN IF NOT EXISTS lineage JSONB`
  await sql`ALTER TABLE course_exchange_copies ADD COLUMN IF NOT EXISTS sync_version INTEGER NOT NULL DEFAULT 1`
  await sql`ALTER TABLE course_exchange_copies ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ`
  await sql`ALTER TABLE course_exchange_copies ADD COLUMN IF NOT EXISTS pending_update_count INTEGER NOT NULL DEFAULT 0`
  await sql`ALTER TABLE course_exchange_copies ADD COLUMN IF NOT EXISTS sync_in_progress BOOLEAN NOT NULL DEFAULT false`
  await sql`ALTER TABLE course_exchange_copies ADD COLUMN IF NOT EXISTS source_manifest_hash TEXT`
  await sql`ALTER TABLE course_exchange_copies ADD COLUMN IF NOT EXISTS cached_sync_diff JSONB`
  await sql`ALTER TABLE course_exchange_copies ADD COLUMN IF NOT EXISTS cached_sync_diff_at TIMESTAMPTZ`
  schemaReady = true
}
