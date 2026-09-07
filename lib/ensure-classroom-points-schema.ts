import { sql } from "@/lib/db"
import { CLASSROOM_BASE_POINTS } from "@/lib/classroom-point-booster"

let ensured = false

/** Max classroom points per row (base 2.5 × timing booster x3). */
export const CLASSROOM_POINTS_MAX = CLASSROOM_BASE_POINTS * 3

/** Clamp fractional classroom points to DB-safe range before write. */
export function clampClassroomPointsForDb(points: number): number {
  const n = Number(points)
  if (!Number.isFinite(n)) return 0
  return Number.parseFloat(Math.min(CLASSROOM_POINTS_MAX, Math.max(0, n)).toFixed(2))
}

/**
 * classroom_points.points must store fractional values (2.5 base, up to 7.5 with booster).
 * Older deployments used INTEGER — migrate to NUMERIC and relax the check constraint.
 */
export async function ensureClassroomPointsSchema(): Promise<void> {
  if (ensured) return

  await sql`
    ALTER TABLE classroom_points
    ADD COLUMN IF NOT EXISTS point_booster INTEGER DEFAULT 1
  `

  try {
    await sql`
      ALTER TABLE classroom_points
      ALTER COLUMN points TYPE NUMERIC(6,2)
      USING COALESCE(points, 0)::numeric
    `
  } catch {
    /* column may already be numeric */
  }

  try {
    await sql`
      UPDATE classroom_points
      SET points = LEAST(GREATEST(COALESCE(points, 0), 0), 7.51)
      WHERE points IS NULL OR points < 0 OR points > 7.51
    `
    await sql`
      ALTER TABLE classroom_points
      DROP CONSTRAINT IF EXISTS classroom_points_points_check
    `
    await sql`
      ALTER TABLE classroom_points
      ADD CONSTRAINT classroom_points_points_check
      CHECK (points >= 0 AND points <= 7.51)
    `
  } catch {
    /* constraint may already match or rows still migrating */
  }

  ensured = true
}
