/**
 * Weekly playground session credits (Scholar / Explorer free tier allowance).
 */

import { sql } from "@/lib/db"
import { PLAYGROUND_WEEKLY_CREDITS, EXPLORER_PLAYGROUND_WEEKLY_CREDITS } from "@/lib/membership-constants"

export function weeklyPlaygroundCreditAllowance(
  creditsLimit: number | "unlimited" | undefined,
): number {
  if (creditsLimit === "unlimited") return PLAYGROUND_WEEKLY_CREDITS
  if (typeof creditsLimit === "number" && creditsLimit > 0) return creditsLimit
  return PLAYGROUND_WEEKLY_CREDITS
}

export async function isNewPlaygroundCreditWeek(lastResetDate: Date | string | null): Promise<boolean> {
  if (!lastResetDate) return true
  const rows = await sql`
    SELECT
      DATE_TRUNC('week', ${lastResetDate}::date)::date < DATE_TRUNC('week', CURRENT_DATE)::date AS needs_reset
  `
  return Boolean(rows[0]?.needs_reset)
}

export async function scholarPlaygroundCreditsUsedThisWeek(studentId: number): Promise<number> {
  const rows = await sql`
    SELECT COALESCE(SUM(credits), 0)::int AS spent
    FROM playground_credit_transactions
    WHERE student_id = ${studentId}
      AND transaction_type = 'spent'
      AND created_at >= DATE_TRUNC('week', CURRENT_DATE)
  `
  return Number(rows[0]?.spent) || 0
}

/** Remaining credits this week based on allowance minus recorded spend. */
export function expectedWeeklyPlaygroundCreditsRemaining(
  weeklyAllowance: number,
  spentThisWeek: number,
): number {
  return Math.max(0, weeklyAllowance - spentThisWeek)
}

/**
 * Align stored balance with weekly allowance and spend history.
 * Top up when balance is below what the student should still have this week.
 */
export async function syncWeeklyPlaygroundCreditBalance(
  studentId: number,
  weeklyAllowance: number,
  lastResetDate: Date | string | null,
  currentCredits: number,
): Promise<number> {
  const needsWeeklyReset = await isNewPlaygroundCreditWeek(lastResetDate)
  if (needsWeeklyReset) {
    await resetPlaygroundCreditsToWeeklyAllowance(
      studentId,
      weeklyAllowance,
      `Weekly playground allowance (${weeklyAllowance} credits)`,
    )
    return weeklyAllowance
  }

  const spentThisWeek = await scholarPlaygroundCreditsUsedThisWeek(studentId)
  const expectedRemaining = expectedWeeklyPlaygroundCreditsRemaining(weeklyAllowance, spentThisWeek)

  if (currentCredits < expectedRemaining) {
    await sql`
      UPDATE playground_credits
      SET credits = ${expectedRemaining},
          last_reset_date = COALESCE(last_reset_date, CURRENT_DATE),
          updated_at = CURRENT_TIMESTAMP
      WHERE student_id = ${studentId}
    `
    return expectedRemaining
  }

  if (currentCredits > weeklyAllowance) {
    await sql`
      UPDATE playground_credits
      SET credits = ${weeklyAllowance}, updated_at = CURRENT_TIMESTAMP
      WHERE student_id = ${studentId}
    `
    return weeklyAllowance
  }

  return currentCredits
}

export async function resetPlaygroundCreditsToWeeklyAllowance(
  studentId: number,
  weeklyCredits: number,
  reason: string,
): Promise<void> {
  await sql`
    UPDATE playground_credits
    SET credits = ${weeklyCredits},
        last_reset_date = CURRENT_DATE,
        updated_at = CURRENT_TIMESTAMP
    WHERE student_id = ${studentId}
  `
  await sql`
    INSERT INTO playground_credit_transactions (student_id, transaction_type, credits, description, source)
    VALUES (${studentId}, 'reset', ${weeklyCredits}, ${reason}, 'weekly_reset')
  `
}

export async function ensurePlaygroundCreditsRow(studentId: number, weeklyCredits: number): Promise<number> {
  const rows = await sql`
    INSERT INTO playground_credits (student_id, credits, last_reset_date, updated_at)
    VALUES (${studentId}, ${weeklyCredits}, CURRENT_DATE, CURRENT_TIMESTAMP)
    ON CONFLICT (student_id) DO NOTHING
    RETURNING credits
  `
  if (rows.length > 0) {
    return Number(rows[0]?.credits) || weeklyCredits
  }

  const existing = await sql`
    SELECT credits FROM playground_credits WHERE student_id = ${studentId} LIMIT 1
  `
  return Number(existing[0]?.credits) || weeklyCredits
}

/**
 * Grant the weekly playground allowance to every Scholar / Explorer student.
 * Safe to run each week (e.g. cron or manual script).
 */
export async function grantWeeklyPlaygroundCreditsToAllEligibleStudents(options?: {
  /** Set every Scholar/Explorer to the weekly allowance now (admin repair), not only on calendar week turn. */
  forceAll?: boolean
}): Promise<{
  inserted: number
  reset: number
  weeklyCredits: { scholar: number; explorer: number }
}> {
  const forceAll = options?.forceAll === true
  const scholarWeekly = PLAYGROUND_WEEKLY_CREDITS
  const explorerWeekly = EXPLORER_PLAYGROUND_WEEKLY_CREDITS

  const inserted = await sql`
    INSERT INTO playground_credits (student_id, credits, last_reset_date, updated_at)
    SELECT
      s.id,
      CASE COALESCE(s.membership_tier, 'Scholar')
        WHEN 'Explorer' THEN ${explorerWeekly}
        ELSE ${scholarWeekly}
      END,
      CURRENT_DATE,
      CURRENT_TIMESTAMP
    FROM students s
    LEFT JOIN playground_credits pc ON pc.student_id = s.id
    WHERE s.deleted_at IS NULL
      AND pc.student_id IS NULL
      AND COALESCE(s.membership_tier, 'Scholar') IN ('Scholar', 'Explorer')
    ON CONFLICT (student_id) DO NOTHING
    RETURNING student_id
  `

  const reset = forceAll
    ? await sql`
        UPDATE playground_credits pc
        SET credits = CASE COALESCE(s.membership_tier, 'Scholar')
              WHEN 'Explorer' THEN ${explorerWeekly}
              ELSE ${scholarWeekly}
            END,
            last_reset_date = CURRENT_DATE,
            updated_at = CURRENT_TIMESTAMP
        FROM students s
        WHERE pc.student_id = s.id
          AND s.deleted_at IS NULL
          AND COALESCE(s.membership_tier, 'Scholar') IN ('Scholar', 'Explorer')
          AND pc.credits IS DISTINCT FROM CASE COALESCE(s.membership_tier, 'Scholar')
              WHEN 'Explorer' THEN ${explorerWeekly}
              ELSE ${scholarWeekly}
            END
        RETURNING pc.student_id, COALESCE(s.membership_tier, 'Scholar') AS tier
      `
    : await sql`
        UPDATE playground_credits pc
        SET credits = CASE COALESCE(s.membership_tier, 'Scholar')
              WHEN 'Explorer' THEN ${explorerWeekly}
              ELSE ${scholarWeekly}
            END,
            last_reset_date = CURRENT_DATE,
            updated_at = CURRENT_TIMESTAMP
        FROM students s
        WHERE pc.student_id = s.id
          AND s.deleted_at IS NULL
          AND COALESCE(s.membership_tier, 'Scholar') IN ('Scholar', 'Explorer')
          AND DATE_TRUNC('week', pc.last_reset_date)::date < DATE_TRUNC('week', CURRENT_DATE)::date
        RETURNING pc.student_id, COALESCE(s.membership_tier, 'Scholar') AS tier
      `

  for (const row of reset as { student_id: number; tier: string }[]) {
    const weeklyCredits = row.tier === "Explorer" ? explorerWeekly : scholarWeekly
    await sql`
      INSERT INTO playground_credit_transactions (student_id, transaction_type, credits, description, source)
      VALUES (${row.student_id}, 'reset', ${weeklyCredits}, 'Weekly Scholar/Explorer playground allowance', 'weekly_reset')
    `
  }

  return {
    inserted: inserted.length,
    reset: reset.length,
    weeklyCredits: { scholar: scholarWeekly, explorer: explorerWeekly },
  }
}
