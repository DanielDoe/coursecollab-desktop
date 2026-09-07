import { sql } from "@/lib/db"

let ensured = false

async function tryMigrate(label: string, run: () => Promise<unknown>): Promise<void> {
  try {
    await run()
  } catch (error) {
    console.error(`[schedule-adjustment schema] ${label}`, error)
  }
}

export async function ensureScheduleAdjustmentSchema(): Promise<void> {
  if (ensured) return

  await sql`
    CREATE TABLE IF NOT EXISTS platform_config (
      key VARCHAR(128) PRIMARY KEY,
      value JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS schedule_adjustment_requests (
      id SERIAL PRIMARY KEY,
      course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
      section_id INTEGER REFERENCES sessions(id) ON DELETE SET NULL,
      section_code VARCHAR(64),
      created_by_id INTEGER NOT NULL REFERENCES instructors(id) ON DELETE RESTRICT,
      status VARCHAR(48) NOT NULL DEFAULT 'DRAFT',
      meeting_type VARCHAR(16) NOT NULL DEFAULT 'lecture',
      reason TEXT NOT NULL,
      availability_starts_at TIMESTAMPTZ,
      availability_ends_at TIMESTAMPTZ NOT NULL,
      candidate_days TEXT[] NOT NULL DEFAULT '{}',
      candidate_start_time TIME NOT NULL,
      candidate_end_time TIME NOT NULL,
      meeting_duration_minutes INTEGER NOT NULL DEFAULT 110,
      slot_increment_minutes INTEGER NOT NULL DEFAULT 30,
      allow_multiple_selections BOOLEAN NOT NULL DEFAULT true,
      availability_mode VARCHAR(16) NOT NULL DEFAULT 'binary',
      instructor_notes TEXT,
      original_schedules JSONB NOT NULL DEFAULT '{}'::jsonb,
      proposed_day VARCHAR(8),
      proposed_start_time TIME,
      proposed_end_time TIME,
      effective_date DATE,
      department_approval_status VARCHAR(16) NOT NULL DEFAULT 'pending',
      department_approved_by TEXT,
      department_approved_at TIMESTAMPTZ,
      department_confirmation_checked BOOLEAN NOT NULL DEFAULT false,
      department_confirmation_checked_by INTEGER REFERENCES instructors(id) ON DELETE SET NULL,
      department_confirmation_checked_at TIMESTAMPTZ,
      building TEXT,
      room TEXT,
      location TEXT,
      consent_document_version INTEGER NOT NULL DEFAULT 1,
      announcement_draft JSONB,
      cancelled_reason TEXT,
      finalized_at TIMESTAMPTZ,
      archived_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS schedule_enrollment_snapshots (
      id SERIAL PRIMARY KEY,
      request_id INTEGER NOT NULL REFERENCES schedule_adjustment_requests(id) ON DELETE CASCADE,
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      enrollment_id INTEGER,
      student_display_name TEXT NOT NULL,
      course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      section_id INTEGER REFERENCES sessions(id) ON DELETE SET NULL,
      section_code VARCHAR(64),
      enrollment_status VARCHAR(32) NOT NULL DEFAULT 'active',
      snapshot_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (request_id, student_id)
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS schedule_availability_responses (
      id SERIAL PRIMARY KEY,
      request_id INTEGER NOT NULL REFERENCES schedule_adjustment_requests(id) ON DELETE CASCADE,
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      availability_data JSONB NOT NULL DEFAULT '{}'::jsonb,
      submitted_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (request_id, student_id)
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS schedule_candidates (
      id SERIAL PRIMARY KEY,
      request_id INTEGER NOT NULL REFERENCES schedule_adjustment_requests(id) ON DELETE CASCADE,
      day_of_week VARCHAR(8) NOT NULL,
      start_time TIME NOT NULL,
      end_time TIME NOT NULL,
      available_count INTEGER NOT NULL DEFAULT 0,
      unavailable_count INTEGER NOT NULL DEFAULT 0,
      non_response_count INTEGER NOT NULL DEFAULT 0,
      preferred_count INTEGER NOT NULL DEFAULT 0,
      agreement_percentage NUMERIC(6,2) NOT NULL DEFAULT 0,
      consensus_category VARCHAR(32) NOT NULL DEFAULT 'partial',
      conflict_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
      selected BOOLEAN NOT NULL DEFAULT false,
      computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (request_id, day_of_week, start_time, end_time)
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS schedule_consents (
      id SERIAL PRIMARY KEY,
      request_id INTEGER NOT NULL REFERENCES schedule_adjustment_requests(id) ON DELETE CASCADE,
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      status VARCHAR(16) NOT NULL DEFAULT 'pending',
      signature_name TEXT,
      signed_at TIMESTAMPTZ,
      decline_reason TEXT,
      decline_category VARCHAR(32),
      document_version INTEGER NOT NULL DEFAULT 1,
      document_hash TEXT,
      ip_address TEXT,
      user_agent TEXT,
      original_schedule JSONB,
      proposed_schedule JSONB,
      invalidated_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (request_id, student_id, document_version)
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS schedule_approval_records (
      id SERIAL PRIMARY KEY,
      request_id INTEGER NOT NULL REFERENCES schedule_adjustment_requests(id) ON DELETE CASCADE,
      approval_type VARCHAR(32) NOT NULL DEFAULT 'department',
      status VARCHAR(16) NOT NULL DEFAULT 'pending',
      approved_by TEXT,
      approved_at TIMESTAMPTZ,
      notes TEXT,
      attachment_url TEXT,
      approval_reference TEXT,
      created_by_id INTEGER REFERENCES instructors(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS course_schedule_versions (
      id SERIAL PRIMARY KEY,
      course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      section_id INTEGER REFERENCES sessions(id) ON DELETE SET NULL,
      request_id INTEGER REFERENCES schedule_adjustment_requests(id) ON DELETE SET NULL,
      version INTEGER NOT NULL,
      meeting_type VARCHAR(16) NOT NULL DEFAULT 'lecture',
      day_of_week VARCHAR(8) NOT NULL,
      start_time TIME NOT NULL,
      end_time TIME NOT NULL,
      location TEXT,
      schedule_text TEXT,
      effective_from DATE NOT NULL,
      effective_until DATE,
      reason TEXT,
      created_by_id INTEGER REFERENCES instructors(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (course_id, section_id, meeting_type, version)
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS schedule_audit_logs (
      id SERIAL PRIMARY KEY,
      request_id INTEGER NOT NULL REFERENCES schedule_adjustment_requests(id) ON DELETE CASCADE,
      actor_id INTEGER,
      actor_role VARCHAR(32),
      action VARCHAR(64) NOT NULL,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `

  await tryMigrate("platform_config threshold", () => sql`
    INSERT INTO platform_config (key, value)
    VALUES ('schedule_change_consent_threshold', '{"percent":50}'::jsonb)
    ON CONFLICT (key) DO NOTHING
  `)
  await tryMigrate("platform_config majority threshold", () => sql`
    UPDATE platform_config
    SET value = '{"percent":50}'::jsonb, updated_at = NOW()
    WHERE key = 'schedule_change_consent_threshold'
      AND (
        COALESCE((value->>'percent')::int, 0) >= 80
        OR (jsonb_typeof(value) = 'number' AND (value::text)::int >= 80)
      )
  `)

  // Optional ALTERs must not 500 the list. Concurrent GETs used to drop/re-add FKs
  // and fail with "constraint already exists".
  await tryMigrate("consents unique drop", () =>
    sql`ALTER TABLE schedule_consents DROP CONSTRAINT IF EXISTS schedule_consents_request_id_student_id_key`,
  )
  await tryMigrate("consents unique index", () => sql`
    CREATE UNIQUE INDEX IF NOT EXISTS schedule_consents_request_student_version_uidx
    ON schedule_consents (request_id, student_id, document_version)
  `)
  await tryMigrate("poll_kind", () =>
    sql`ALTER TABLE schedule_adjustment_requests ADD COLUMN IF NOT EXISTS poll_kind VARCHAR(16) NOT NULL DEFAULT 'recurring'`,
  )
  await tryMigrate("candidate_dates", () =>
    sql`ALTER TABLE schedule_adjustment_requests ADD COLUMN IF NOT EXISTS candidate_dates TEXT[] NOT NULL DEFAULT '{}'`,
  )
  await tryMigrate("missed_class_date", () =>
    sql`ALTER TABLE schedule_adjustment_requests ADD COLUMN IF NOT EXISTS missed_class_date DATE`,
  )
  await tryMigrate("proposed_date", () =>
    sql`ALTER TABLE schedule_adjustment_requests ADD COLUMN IF NOT EXISTS proposed_date DATE`,
  )
  await tryMigrate("proposed_day type", () =>
    sql`ALTER TABLE schedule_adjustment_requests ALTER COLUMN proposed_day TYPE VARCHAR(16)`,
  )
  await tryMigrate("candidate day type", () =>
    sql`ALTER TABLE schedule_candidates ALTER COLUMN day_of_week TYPE VARCHAR(16)`,
  )
  await tryMigrate("makeup meetings", () => sql`
    CREATE TABLE IF NOT EXISTS course_makeup_meetings (
      id SERIAL PRIMARY KEY,
      course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      section_id INTEGER,
      request_id INTEGER REFERENCES schedule_adjustment_requests(id) ON DELETE SET NULL,
      missed_date DATE NOT NULL,
      new_date DATE NOT NULL,
      start_time TIME NOT NULL,
      end_time TIME NOT NULL,
      location TEXT,
      created_by_id INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await tryMigrate("makeup index", () =>
    sql`CREATE INDEX IF NOT EXISTS idx_course_makeup_course ON course_makeup_meetings(course_id)`,
  )

  await tryMigrate("adjustment_mode", () =>
    sql`ALTER TABLE schedule_adjustment_requests ADD COLUMN IF NOT EXISTS adjustment_mode VARCHAR(32) NOT NULL DEFAULT 'AVAILABILITY_BASED'`,
  )
  await tryMigrate("instructor_led_day", () =>
    sql`ALTER TABLE schedule_adjustment_requests ADD COLUMN IF NOT EXISTS instructor_led_day VARCHAR(16)`,
  )
  await tryMigrate("instructor_led_start", () =>
    sql`ALTER TABLE schedule_adjustment_requests ADD COLUMN IF NOT EXISTS instructor_led_start_time TIME`,
  )
  await tryMigrate("instructor_led_end", () =>
    sql`ALTER TABLE schedule_adjustment_requests ADD COLUMN IF NOT EXISTS instructor_led_end_time TIME`,
  )
  await tryMigrate("structured_day", () =>
    sql`ALTER TABLE schedule_adjustment_requests ADD COLUMN IF NOT EXISTS structured_session_day VARCHAR(16)`,
  )
  await tryMigrate("structured_start", () =>
    sql`ALTER TABLE schedule_adjustment_requests ADD COLUMN IF NOT EXISTS structured_session_start_time TIME`,
  )
  await tryMigrate("structured_end", () =>
    sql`ALTER TABLE schedule_adjustment_requests ADD COLUMN IF NOT EXISTS structured_session_end_time TIME`,
  )
  await tryMigrate("department_note", () =>
    sql`ALTER TABLE schedule_adjustment_requests ADD COLUMN IF NOT EXISTS department_note TEXT`,
  )
  await tryMigrate("schedule_version_id", () =>
    sql`ALTER TABLE schedule_adjustment_requests ADD COLUMN IF NOT EXISTS schedule_version_id INTEGER`,
  )
  await tryMigrate("late_threshold", () =>
    sql`ALTER TABLE schedule_adjustment_requests ADD COLUMN IF NOT EXISTS attendance_late_threshold_minutes INTEGER NOT NULL DEFAULT 20`,
  )
  await tryMigrate("instructor_proposal_confirmed", () =>
    sql`ALTER TABLE schedule_adjustment_requests ADD COLUMN IF NOT EXISTS instructor_proposal_confirmed BOOLEAN NOT NULL DEFAULT false`,
  )
  await tryMigrate("instructor_proposal_confirmed_at", () =>
    sql`ALTER TABLE schedule_adjustment_requests ADD COLUMN IF NOT EXISTS instructor_proposal_confirmed_at TIMESTAMPTZ`,
  )
  await tryMigrate("instructor_proposal_confirmed_by", () =>
    sql`ALTER TABLE schedule_adjustment_requests ADD COLUMN IF NOT EXISTS instructor_proposal_confirmed_by INTEGER`,
  )
  await tryMigrate("availability_archived_at", () =>
    sql`ALTER TABLE schedule_adjustment_requests ADD COLUMN IF NOT EXISTS availability_archived_at TIMESTAMPTZ`,
  )
  await tryMigrate("consent concern status", () =>
    sql`ALTER TABLE schedule_consents ALTER COLUMN status TYPE VARCHAR(24)`,
  )
  await tryMigrate("attendance session_type", () =>
    sql`ALTER TABLE attendance_sessions ADD COLUMN IF NOT EXISTS session_type VARCHAR(48) NOT NULL DEFAULT 'INSTRUCTOR_LED'`,
  )
  await tryMigrate("attendance schedule_version", () =>
    sql`ALTER TABLE attendance_sessions ADD COLUMN IF NOT EXISTS schedule_version_id INTEGER`,
  )
  await tryMigrate("attendance late minutes", () =>
    sql`ALTER TABLE attendance_sessions ADD COLUMN IF NOT EXISTS late_threshold_minutes INTEGER NOT NULL DEFAULT 20`,
  )
  await tryMigrate("attendance request_id", () =>
    sql`ALTER TABLE attendance_sessions ADD COLUMN IF NOT EXISTS request_id INTEGER`,
  )
  await tryMigrate("attendance self_checkin", () =>
    sql`ALTER TABLE attendance_sessions ADD COLUMN IF NOT EXISTS self_checkin_enabled BOOLEAN NOT NULL DEFAULT false`,
  )
  await tryMigrate("attendance audit", () => sql`
    CREATE TABLE IF NOT EXISTS attendance_audit_logs (
      id SERIAL PRIMARY KEY,
      session_id INTEGER NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      original_status VARCHAR(16),
      new_status VARCHAR(16) NOT NULL,
      check_in_timestamp TIMESTAMPTZ,
      server_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      schedule_version INTEGER,
      session_type VARCHAR(48),
      instructor_override BOOLEAN NOT NULL DEFAULT false,
      override_reason TEXT,
      actor_id INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await tryMigrate("structured activities", () => sql`
    CREATE TABLE IF NOT EXISTS structured_session_activities (
      id SERIAL PRIMARY KEY,
      attendance_session_id INTEGER REFERENCES attendance_sessions(id) ON DELETE CASCADE,
      course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      section_id INTEGER,
      request_id INTEGER,
      activity_type VARCHAR(32) NOT NULL,
      activity_ref TEXT,
      title TEXT NOT NULL,
      created_by_id INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await tryMigrate("schedule version session_kind", () =>
    sql`ALTER TABLE course_schedule_versions ADD COLUMN IF NOT EXISTS session_kind VARCHAR(32)`,
  )
  await tryMigrate("version meeting_type width", () =>
    sql`ALTER TABLE course_schedule_versions ALTER COLUMN meeting_type TYPE VARCHAR(32)`,
  )

  ensured = true
}
