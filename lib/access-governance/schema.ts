import { sql } from "@/lib/db"

let schemaReady = false

/** Idempotent schema extensions for Access Governance. */
export async function ensureAccessGovernanceSchema(): Promise<void> {
  if (schemaReady) return

  await sql`ALTER TABLE account_requests ADD COLUMN IF NOT EXISTS request_kind VARCHAR(32) NOT NULL DEFAULT 'roster'`
  await sql`ALTER TABLE account_requests ADD COLUMN IF NOT EXISTS university_id INTEGER`
  await sql`ALTER TABLE account_requests ADD COLUMN IF NOT EXISTS course_id INTEGER`
  await sql`ALTER TABLE account_requests ADD COLUMN IF NOT EXISTS session_id INTEGER`
  await sql`ALTER TABLE account_requests ADD COLUMN IF NOT EXISTS camp_id INTEGER`
  await sql`ALTER TABLE account_requests ADD COLUMN IF NOT EXISTS sponsoring_faculty_id INTEGER`
  await sql`ALTER TABLE account_requests ADD COLUMN IF NOT EXISTS invitation_id INTEGER`
  await sql`ALTER TABLE account_requests ADD COLUMN IF NOT EXISTS account_type VARCHAR(32)`
  await sql`ALTER TABLE account_requests ADD COLUMN IF NOT EXISTS approval_source VARCHAR(32)`
  await sql`ALTER TABLE account_requests ADD COLUMN IF NOT EXISTS reviewer_role VARCHAR(32)`
  await sql`ALTER TABLE account_requests ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ`
  await sql`ALTER TABLE account_requests ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb`

  await sql`
    CREATE TABLE IF NOT EXISTS access_invitations (
      id SERIAL PRIMARY KEY,
      token_hash VARCHAR(128) NOT NULL UNIQUE,
      created_by INTEGER REFERENCES instructors(id) ON DELETE SET NULL,
      university_id INTEGER,
      scope_type VARCHAR(32) NOT NULL,
      course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
      session_id INTEGER REFERENCES sessions(id) ON DELETE CASCADE,
      camp_id INTEGER REFERENCES summer_camps(id) ON DELETE CASCADE,
      allowed_account_type VARCHAR(32) NOT NULL,
      approval_behavior VARCHAR(64) NOT NULL DEFAULT 'require_faculty_approval',
      expires_at TIMESTAMPTZ,
      max_uses INTEGER NOT NULL DEFAULT 1,
      current_uses INTEGER NOT NULL DEFAULT 0,
      status VARCHAR(32) NOT NULL DEFAULT 'active',
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_access_invitations_course ON access_invitations(course_id)`
  await sql`CREATE INDEX IF NOT EXISTS idx_access_invitations_status ON access_invitations(status)`

  await sql`ALTER TABLE students ADD COLUMN IF NOT EXISTS account_lifecycle_status VARCHAR(32) NOT NULL DEFAULT 'active'`
  await sql`ALTER TABLE instructors ADD COLUMN IF NOT EXISTS account_lifecycle_status VARCHAR(32) NOT NULL DEFAULT 'active'`

  await sql`
    CREATE TABLE IF NOT EXISTS career_member_sponsorships (
      id SERIAL PRIMARY KEY,
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      sponsoring_faculty_id INTEGER NOT NULL REFERENCES instructors(id) ON DELETE CASCADE,
      status VARCHAR(32) NOT NULL DEFAULT 'active',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (student_id, sponsoring_faculty_id)
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS access_email_verifications (
      id SERIAL PRIMARY KEY,
      account_request_id INTEGER NOT NULL REFERENCES account_requests(id) ON DELETE CASCADE,
      email VARCHAR(255) NOT NULL,
      token_hash VARCHAR(128) NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      verified_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_access_email_verifications_request ON access_email_verifications(account_request_id)`

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS account_requests_one_pending_per_email_uidx
    ON account_requests (LOWER(TRIM(email)), request_kind)
    WHERE status = 'pending' AND email IS NOT NULL AND TRIM(email) <> ''
  `

  schemaReady = true
}
