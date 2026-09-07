import { sql } from "@/lib/db"

let ensured = false

export async function ensureCampModuleScheduleColumns() {
  if (ensured) return
  await sql`ALTER TABLE camp_modules ADD COLUMN IF NOT EXISTS schedule_day INTEGER`
  await sql`ALTER TABLE camp_modules ADD COLUMN IF NOT EXISTS schedule_day_sort INTEGER NOT NULL DEFAULT 0`
  await sql`ALTER TABLE camp_modules ADD COLUMN IF NOT EXISTS is_visible BOOLEAN NOT NULL DEFAULT true`
  await sql`ALTER TABLE camp_modules ADD COLUMN IF NOT EXISTS display_number INTEGER`
  await sql`ALTER TABLE camp_trainings ADD COLUMN IF NOT EXISTS schedule_days JSONB NOT NULL DEFAULT '[]'::jsonb`
  await sql`ALTER TABLE camp_trainings ADD COLUMN IF NOT EXISTS schedule_module_rules JSONB NOT NULL DEFAULT '[]'::jsonb`
  ensured = true
}
