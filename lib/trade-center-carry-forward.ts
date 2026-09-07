/**
 * Trade Center: carry untraded activity points across weekly earning windows.
 * Weekly caps still apply to new earnings; unused tradable balance persists.
 */

import { sql } from "@/lib/db"
import { splitTradeDeduction } from "@/lib/engagement-points-system"
import { getWeekStartDateString } from "@/lib/trade-center-shared"

export async function ensureCarriedOverPointsColumn(): Promise<void> {
  await sql`
    ALTER TABLE student_activity_points
    ADD COLUMN IF NOT EXISTS carried_over_points INTEGER NOT NULL DEFAULT 0
  `
}

/** Frozen carry balance at the start of the week; trades/donations never mutate this. */
export async function ensureWeekOpeningCarryColumn(): Promise<void> {
  await ensureCarriedOverPointsColumn()
  await sql`
    ALTER TABLE student_activity_points
    ADD COLUMN IF NOT EXISTS week_opening_carry INTEGER NOT NULL DEFAULT 0
  `
}

const POINTS_SPEND_TRANSACTION_TYPES = ["TRADE", "DONATION"] as const

/** Sum of activity points spent via Trade Center this week (trades + donations). */
export async function getTotalPointsSpentThisWeek(
  studentId: number,
  session: string,
  weekStartDate: string,
  weekEndExclusive: string,
): Promise<number> {
  try {
    const rows = await sql`
      SELECT COALESCE(SUM(points_used), 0)::int AS total_spent
      FROM trade_transactions
      WHERE student_id = ${studentId}
        AND session = ${session}
        AND transaction_type = ANY(${POINTS_SPEND_TRANSACTION_TYPES})
        AND created_at >= ${weekStartDate}::date
        AND created_at < ${weekEndExclusive}::date
    `
    return Number(rows[0]?.total_spent) || 0
  } catch {
    return 0
  }
}

export function tradableActivityPoints(row: {
  practice_points?: number | null
  playground_points?: number | null
  reading_points?: number | null
  total_points?: number | null
  carried_over_points?: number | null
}): number {
  const weekly =
    row.total_points != null
      ? Number(row.total_points)
      : Number(row.practice_points ?? 0) +
        Number(row.playground_points ?? 0) +
        Number(row.reading_points ?? 0)
  return weekly + Number(row.carried_over_points ?? 0)
}

/** Balance rolled from all weeks before `currentWeekStart`. */
export async function computeCarryForwardFromPriorWeeks(
  studentId: number,
  session: string,
  currentWeekStart: string,
): Promise<number> {
  await ensureCarriedOverPointsColumn()
  const rows = await sql`
    SELECT total_points, carried_over_points
    FROM student_activity_points
    WHERE student_id = ${studentId}
      AND session = ${session}
      AND week_start_date < ${currentWeekStart}::date
    ORDER BY week_start_date ASC
  `
  return (rows as Array<{ total_points: number; carried_over_points: number | null }>).reduce(
    (sum, r) => sum + tradableActivityPoints(r),
    0,
  )
}

export async function resolveCarriedOverForWeek(
  studentId: number,
  session: string,
  weekStartDate: string,
  weeklyResetDay: number,
): Promise<number> {
  await ensureCarriedOverPointsColumn()

  const existing = await sql`
    SELECT carried_over_points
    FROM student_activity_points
    WHERE student_id = ${studentId}
      AND session = ${session}
      AND week_start_date = ${weekStartDate}::date
    LIMIT 1
  `
  if (existing.length > 0) {
    return Number(existing[0].carried_over_points ?? 0)
  }

  const prevStart = getWeekStartDateString(
    new Date(new Date(`${weekStartDate}T12:00:00`).getTime() - 7 * 86400000),
    weeklyResetDay,
  )

  const prev = await sql`
    SELECT practice_points, playground_points, reading_points, total_points, carried_over_points
    FROM student_activity_points
    WHERE student_id = ${studentId}
      AND session = ${session}
      AND week_start_date = ${prevStart}::date
    LIMIT 1
  `

  if (prev.length === 0) {
    return computeCarryForwardFromPriorWeeks(studentId, session, weekStartDate)
  }

  return tradableActivityPoints(prev[0] as Parameters<typeof tradableActivityPoints>[0])
}

export function applyTradePointDeduction(
  pointsToTrade: number,
  carriedOver: number,
  practice: number,
  playground: number,
  reading: number,
): {
  carriedOver: number
  practice: number
  playground: number
  reading: number
} {
  let remaining = Math.max(0, pointsToTrade)
  let co = Math.max(0, carriedOver)
  const fromCarry = Math.min(co, remaining)
  co -= fromCarry
  remaining -= fromCarry

  const split = splitTradeDeduction(remaining, practice, playground, reading)
  return {
    carriedOver: co,
    practice: Math.max(0, practice - split.practice),
    playground: Math.max(0, playground - split.playground),
    reading: Math.max(0, reading - split.reading),
  }
}

export async function fetchLifetimeEngagementCredits(
  studentId: number,
  session: string,
): Promise<number> {
  try {
    const rows = await sql`
      SELECT total_credits FROM engagement_credits
      WHERE student_id = ${studentId} AND session = ${session}
      LIMIT 1
    `
    if (rows.length > 0) {
      return Number(rows[0].total_credits ?? 0)
    }
  } catch {
    /* table may be missing */
  }
  return 0
}

/**
 * Derive spendable balances from gross weekly earnings, frozen week-opening carry,
 * and the trade/donation ledger. Safe to call on every sync — idempotent.
 */
export async function reconcileSpendablePoints(
  studentId: number,
  session: string,
  weekStartDate: string,
  weekEndExclusive: string,
  gross: { practice: number; playground: number; reading: number },
  weekOpeningCarry: number,
): Promise<{ practice: number; playground: number; reading: number; carriedOver: number }> {
  const totalSpent = await getTotalPointsSpentThisWeek(
    studentId,
    session,
    weekStartDate,
    weekEndExclusive,
  )

  const deducted = applyTradePointDeduction(
    totalSpent,
    weekOpeningCarry,
    gross.practice,
    gross.playground,
    gross.reading,
  )

  return {
    carriedOver: deducted.carriedOver,
    practice: deducted.practice,
    playground: deducted.playground,
    reading: deducted.reading,
  }
}

/**
 * Infer week_opening_carry for legacy rows that predate the column.
 * opening_carry = current_carry + carry portion already spent this week.
 */
export function inferWeekOpeningCarry(
  weekOpeningCarryStored: number | null | undefined,
  currentCarriedOver: number,
  totalSpentThisWeek: number,
  gross: { practice: number; playground: number; reading: number },
  storedWeekly: { practice: number; playground: number; reading: number },
): number {
  if (weekOpeningCarryStored != null && Number.isFinite(Number(weekOpeningCarryStored))) {
    return Math.max(0, Number(weekOpeningCarryStored))
  }

  const grossTotal = gross.practice + gross.playground + gross.reading
  const weeklyRemaining =
    storedWeekly.practice + storedWeekly.playground + storedWeekly.reading
  const spentFromWeekly = Math.max(0, grossTotal - weeklyRemaining)
  const spentFromCarry = Math.max(0, totalSpentThisWeek - spentFromWeekly)
  return Math.max(0, currentCarriedOver + spentFromCarry)
}
