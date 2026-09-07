import { sql } from "@/lib/db"

let ensured = false

/** Idempotent schema for faculty membership billing. */
export async function ensureInstructorMembershipSchema(): Promise<void> {
  if (ensured) return

  await sql`ALTER TABLE instructors ADD COLUMN IF NOT EXISTS membership_tier VARCHAR(32) NOT NULL DEFAULT 'Free'`
  await sql`ALTER TABLE instructors ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255)`

  await sql`
    CREATE TABLE IF NOT EXISTS instructor_memberships (
      id SERIAL PRIMARY KEY,
      instructor_id INTEGER NOT NULL REFERENCES instructors(id) ON DELETE CASCADE,
      tier VARCHAR(32) NOT NULL DEFAULT 'Free',
      plan VARCHAR(32) NOT NULL DEFAULT 'Free',
      status VARCHAR(32) NOT NULL DEFAULT 'active',
      stripe_customer_id VARCHAR(255),
      stripe_checkout_session_id VARCHAR(255),
      billing_cadence VARCHAR(16),
      expires_at TIMESTAMPTZ,
      end_date TIMESTAMPTZ,
      auto_renew BOOLEAN NOT NULL DEFAULT false,
      start_date TIMESTAMPTZ DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS instructor_memberships_instructor_id_uidx
    ON instructor_memberships (instructor_id)
  `

  await sql`
    CREATE INDEX IF NOT EXISTS instructor_memberships_stripe_session_idx
    ON instructor_memberships (stripe_checkout_session_id)
    WHERE stripe_checkout_session_id IS NOT NULL
  `

  await sql`UPDATE instructors SET membership_tier = 'Free' WHERE membership_tier IS NULL OR TRIM(membership_tier) = ''`

  ensured = true
}
