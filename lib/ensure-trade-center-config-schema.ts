import { sql } from "@/lib/db"

let ensured = false

/** Optional activity toggles on trade_center_config (added after initial schema). */
export async function ensureTradeCenterConfigSchema(): Promise<void> {
  if (ensured) return

  await sql`ALTER TABLE trade_center_config ADD COLUMN IF NOT EXISTS practice_enabled BOOLEAN DEFAULT true`
  await sql`ALTER TABLE trade_center_config ADD COLUMN IF NOT EXISTS playground_enabled BOOLEAN DEFAULT true`
  await sql`ALTER TABLE trade_center_config ADD COLUMN IF NOT EXISTS reading_enabled BOOLEAN DEFAULT true`

  ensured = true
}
