import { sql } from "@/lib/db"

let ensured = false

/** Align donations table with webhook/sync routes (payment_method, etc.). */
export async function ensureDonationsSchema(): Promise<void> {
  if (ensured) return

  await sql`
    ALTER TABLE donations
    ADD COLUMN IF NOT EXISTS payment_method VARCHAR(64)
  `
  await sql`
    ALTER TABLE donations
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()
  `
  await sql`
    ALTER TABLE donations
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ
  `
  await sql`
    ALTER TABLE donations
    ADD COLUMN IF NOT EXISTS error_message TEXT
  `
  await sql`
    ALTER TABLE donations
    ADD COLUMN IF NOT EXISTS failed_at TIMESTAMPTZ
  `

  ensured = true
}
