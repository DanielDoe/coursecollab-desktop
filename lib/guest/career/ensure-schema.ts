import { sql } from "@/lib/db"

let schemaReady = false

export async function ensureGuestCareerIntelligenceSchema(): Promise<void> {
  if (schemaReady) return

  await sql`
    CREATE TABLE IF NOT EXISTS guest_career_resumes (
      id SERIAL PRIMARY KEY,
      guest_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      is_master BOOLEAN NOT NULL DEFAULT false,
      label TEXT,
      original_file_name TEXT,
      original_file_url TEXT,
      original_mime TEXT,
      profile JSONB NOT NULL DEFAULT '{}'::jsonb,
      parsed_text TEXT NOT NULL DEFAULT '',
      content_hash TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_guest_career_resumes_guest ON guest_career_resumes (guest_id, is_master DESC, updated_at DESC)`

  await sql`
    CREATE TABLE IF NOT EXISTS guest_career_opportunities (
      id SERIAL PRIMARY KEY,
      guest_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      type VARCHAR(32) NOT NULL DEFAULT 'JOB',
      organization TEXT,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      source_url TEXT,
      location TEXT,
      deadline TIMESTAMPTZ,
      profile JSONB NOT NULL DEFAULT '{}'::jsonb,
      content_hash TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_guest_career_opportunities_guest ON guest_career_opportunities (guest_id, updated_at DESC)`

  await sql`
    CREATE TABLE IF NOT EXISTS guest_career_applications (
      id SERIAL PRIMARY KEY,
      guest_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      opportunity_id INTEGER NOT NULL REFERENCES guest_career_opportunities(id) ON DELETE CASCADE,
      master_resume_id INTEGER REFERENCES guest_career_resumes(id) ON DELETE SET NULL,
      resume_version_id INTEGER,
      status VARCHAR(24) NOT NULL DEFAULT 'SAVED',
      match_score INTEGER,
      match_band VARCHAR(32),
      cover_letter_status VARCHAR(24) NOT NULL DEFAULT 'NOT_STARTED',
      interview_prep_status VARCHAR(24) NOT NULL DEFAULT 'NOT_STARTED',
      applied_at TIMESTAMPTZ,
      notes TEXT,
      latest_analysis_id INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_guest_career_applications_guest ON guest_career_applications (guest_id, updated_at DESC)`

  await sql`
    CREATE TABLE IF NOT EXISTS guest_career_resume_versions (
      id SERIAL PRIMARY KEY,
      guest_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      master_resume_id INTEGER NOT NULL REFERENCES guest_career_resumes(id) ON DELETE CASCADE,
      application_id INTEGER REFERENCES guest_career_applications(id) ON DELETE SET NULL,
      label TEXT NOT NULL,
      profile JSONB NOT NULL DEFAULT '{}'::jsonb,
      parsed_text TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS guest_career_analyses (
      id SERIAL PRIMARY KEY,
      guest_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      application_id INTEGER REFERENCES guest_career_applications(id) ON DELETE SET NULL,
      resume_id INTEGER NOT NULL REFERENCES guest_career_resumes(id) ON DELETE CASCADE,
      opportunity_id INTEGER NOT NULL REFERENCES guest_career_opportunities(id) ON DELETE CASCADE,
      resume_hash TEXT NOT NULL,
      opportunity_hash TEXT NOT NULL,
      algorithm_version TEXT NOT NULL,
      weights_version TEXT NOT NULL,
      overall_score INTEGER NOT NULL,
      match_band VARCHAR(32) NOT NULL,
      analysis JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`
    CREATE INDEX IF NOT EXISTS idx_guest_career_analyses_cache
    ON guest_career_analyses (guest_id, resume_hash, opportunity_hash, algorithm_version, weights_version, created_at DESC)
  `

  await sql`
    CREATE TABLE IF NOT EXISTS guest_career_cover_letters (
      id SERIAL PRIMARY KEY,
      guest_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      application_id INTEGER NOT NULL REFERENCES guest_career_applications(id) ON DELETE CASCADE,
      body TEXT NOT NULL DEFAULT '',
      tone VARCHAR(32) NOT NULL DEFAULT 'professional',
      status VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_guest_career_cover_letters_app ON guest_career_cover_letters (application_id)`

  await sql`
    CREATE TABLE IF NOT EXISTS guest_cora_profiles (
      guest_id INTEGER PRIMARY KEY REFERENCES students(id) ON DELETE CASCADE,
      career_summary TEXT NOT NULL DEFAULT '',
      goals TEXT NOT NULL DEFAULT '',
      target_roles TEXT[] NOT NULL DEFAULT '{}',
      focus_topics TEXT[] NOT NULL DEFAULT '{}',
      cora_notes JSONB NOT NULL DEFAULT '{}'::jsonb,
      last_context_sync_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `

  schemaReady = true
}
