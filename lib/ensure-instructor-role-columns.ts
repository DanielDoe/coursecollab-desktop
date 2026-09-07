import { sql } from "@/lib/db"

let ensured = false

/** Adds role/is_active/TA assignment columns if missing (idempotent). */
export async function ensureInstructorRoleColumns(): Promise<void> {
  if (ensured) return
  await sql`ALTER TABLE instructors ADD COLUMN IF NOT EXISTS role VARCHAR(32) NOT NULL DEFAULT 'instructor'`
  await sql`ALTER TABLE instructors ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true`
  await sql`ALTER TABLE instructors ADD COLUMN IF NOT EXISTS assigned_instructor_id INTEGER REFERENCES instructors(id) ON DELETE SET NULL`
  await sql`UPDATE instructors SET role = 'instructor' WHERE role IS NULL OR TRIM(role) = ''`
  await sql`UPDATE instructors SET is_active = true WHERE is_active IS NULL`
  await sql`ALTER TABLE instructors ADD COLUMN IF NOT EXISTS has_changed_password BOOLEAN NOT NULL DEFAULT true`
  await sql`UPDATE instructors SET has_changed_password = true WHERE has_changed_password IS NULL`
  ensured = true
}
