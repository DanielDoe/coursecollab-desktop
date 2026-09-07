import { sql } from "@/lib/db"

let ensured = false

export async function ensureMfaSchema() {
  if (ensured) return

  await sql`
    CREATE TABLE IF NOT EXISTS user_mfa (
      id SERIAL PRIMARY KEY,
      user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('student', 'instructor', 'admin')),
      user_id INTEGER NOT NULL,
      totp_secret_encrypted TEXT NOT NULL,
      enabled_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (user_type, user_id)
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS user_mfa_recovery_codes (
      id SERIAL PRIMARY KEY,
      user_mfa_id INTEGER NOT NULL REFERENCES user_mfa(id) ON DELETE CASCADE,
      code_hash VARCHAR(64) NOT NULL,
      used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `

  await sql`CREATE INDEX IF NOT EXISTS idx_user_mfa_recovery_mfa_id ON user_mfa_recovery_codes(user_mfa_id)`

  await sql`
    CREATE TABLE IF NOT EXISTS auth_mfa_challenges (
      id BIGSERIAL PRIMARY KEY,
      token_hash VARCHAR(64) NOT NULL UNIQUE,
      user_type VARCHAR(20) NOT NULL,
      user_id INTEGER NOT NULL,
      requires_setup BOOLEAN NOT NULL DEFAULT false,
      login_payload JSONB NOT NULL,
      pending_secret_encrypted TEXT,
      expires_at TIMESTAMPTZ NOT NULL,
      consumed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `

  await sql`CREATE INDEX IF NOT EXISTS idx_auth_mfa_challenges_expires ON auth_mfa_challenges(expires_at)`

  await sql`
    ALTER TABLE user_mfa
    ADD COLUMN IF NOT EXISTS trust_duration_days INTEGER NOT NULL DEFAULT 7
  `

  await sql`
    CREATE TABLE IF NOT EXISTS user_mfa_device_trust (
      id BIGSERIAL PRIMARY KEY,
      user_type VARCHAR(20) NOT NULL,
      user_id INTEGER NOT NULL,
      token_hash VARCHAR(64) NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `

  await sql`CREATE INDEX IF NOT EXISTS idx_user_mfa_device_trust_user ON user_mfa_device_trust(user_type, user_id)`
  await sql`CREATE INDEX IF NOT EXISTS idx_user_mfa_device_trust_expires ON user_mfa_device_trust(expires_at)`

  ensured = true
}
