import { sql } from "@/lib/db"
import { CORA_MIN_PREMIUM_CREDITS } from "@/lib/cora/credits/economy"
import { creditPeriodAction } from "@/lib/cora/credits/period-reset"
import type { CoraUserRole } from "@/lib/cora/ai/types"
import { combinePeriodUsage } from "@/lib/cora/ai/credit-reconcile"

export type ObservedCoraUsage = {
  usageEvents: number
  ledgerUsage: number
  legacySpent: number
  conversationEstimate: number
  periodUsed: number
  lifetimeUsed: number
  legacyIncluded: number | null
  legacyPurchased: number | null
  legacyPeriodMatches: boolean
}

async function sumSafe(fn: () => Promise<number>): Promise<number> {
  try {
    const n = await fn()
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
  } catch {
    return 0
  }
}

export async function observeCoraUsage(args: {
  userId: number
  userRole: CoraUserRole
  periodKey: string
  periodStart: Date
}): Promise<ObservedCoraUsage> {
  const since = args.periodStart.toISOString()
  const userId = args.userId
  const role = args.userRole

  const usageEvents = await sumSafe(async () => {
    const rows = (await sql`
      SELECT COALESCE(SUM(credits_charged), 0)::int AS n
      FROM cora_usage_events
      WHERE user_role = ${role}
        AND user_id = ${userId}
        AND created_at >= ${since}
        AND COALESCE(credits_charged, 0) > 0
    `) as Array<{ n: number }>
    return Number(rows[0]?.n ?? 0)
  })

  const ledgerUsage = await sumSafe(async () => {
    const rows = (await sql`
      SELECT COALESCE(SUM(ABS(amount)), 0)::int AS n
      FROM cora_credit_transactions
      WHERE user_role = ${role}
        AND user_id = ${userId}
        AND type = 'USAGE'
        AND created_at >= ${since}
    `) as Array<{ n: number }>
    return Number(rows[0]?.n ?? 0)
  })

  const lifetimeFromEvents = await sumSafe(async () => {
    const rows = (await sql`
      SELECT COALESCE(SUM(credits_charged), 0)::int AS n
      FROM cora_usage_events
      WHERE user_role = ${role}
        AND user_id = ${userId}
        AND COALESCE(credits_charged, 0) > 0
    `) as Array<{ n: number }>
    return Number(rows[0]?.n ?? 0)
  })

  const lifetimeFromLedger = await sumSafe(async () => {
    const rows = (await sql`
      SELECT COALESCE(SUM(ABS(amount)), 0)::int AS n
      FROM cora_credit_transactions
      WHERE user_role = ${role}
        AND user_id = ${userId}
        AND type = 'USAGE'
    `) as Array<{ n: number }>
    return Number(rows[0]?.n ?? 0)
  })

  let legacySpent = 0
  let lifetimeLegacy = 0
  let legacyIncluded: number | null = null
  let legacyPurchased: number | null = null
  let legacyPeriodMatches = false
  let conversationEstimate = 0

  if (role === "student") {
    legacySpent = await sumSafe(async () => {
      const rows = (await sql`
        SELECT COALESCE(SUM(credits), 0)::int AS n
        FROM ai_tutor_credit_transactions
        WHERE student_id = ${userId}
          AND transaction_type = 'spent'
          AND created_at >= ${since}
      `) as Array<{ n: number }>
      return Number(rows[0]?.n ?? 0)
    })
    lifetimeLegacy = await sumSafe(async () => {
      const rows = (await sql`
        SELECT COALESCE(SUM(credits), 0)::int AS n
        FROM ai_tutor_credit_transactions
        WHERE student_id = ${userId}
          AND transaction_type = 'spent'
      `) as Array<{ n: number }>
      return Number(rows[0]?.n ?? 0)
    })
    try {
      const rows = (await sql`
        SELECT credits, purchased_credits, period_key
        FROM ai_tutor_credits
        WHERE student_id = ${userId}
        LIMIT 1
      `) as Array<{ credits: number; purchased_credits: number; period_key: string | null }>
      if (rows[0]) {
        legacyIncluded = Number(rows[0].credits ?? 0)
        legacyPurchased = Number(rows[0].purchased_credits ?? 0)
        legacyPeriodMatches = creditPeriodAction(rows[0].period_key, args.periodKey) === "keep"
      }
    } catch {
      /* legacy table may lag */
    }
    conversationEstimate = await sumSafe(async () => {
      const rows = (await sql`
        SELECT COUNT(*)::int AS n
        FROM ai_tutor_conversations
        WHERE student_id = ${userId}
          AND created_at >= ${since}
      `) as Array<{ n: number }>
      return Number(rows[0]?.n ?? 0) * CORA_MIN_PREMIUM_CREDITS
    })
  } else if (role === "instructor") {
    legacySpent = await sumSafe(async () => {
      const rows = (await sql`
        SELECT COALESCE(SUM(credits), 0)::int AS n
        FROM instructor_cora_credit_transactions
        WHERE instructor_id = ${userId}
          AND transaction_type = 'spent'
          AND created_at >= ${since}
      `) as Array<{ n: number }>
      return Number(rows[0]?.n ?? 0)
    })
    lifetimeLegacy = await sumSafe(async () => {
      const rows = (await sql`
        SELECT COALESCE(SUM(credits), 0)::int AS n
        FROM instructor_cora_credit_transactions
        WHERE instructor_id = ${userId}
          AND transaction_type = 'spent'
      `) as Array<{ n: number }>
      return Number(rows[0]?.n ?? 0)
    })
    try {
      const rows = (await sql`
        SELECT membership_credits, purchased_credits, period_key
        FROM instructor_cora_credits
        WHERE instructor_id = ${userId}
        LIMIT 1
      `) as Array<{
        membership_credits: number
        purchased_credits: number
        period_key: string | null
      }>
      if (rows[0]) {
        legacyIncluded = Number(rows[0].membership_credits ?? 0)
        legacyPurchased = Number(rows[0].purchased_credits ?? 0)
        legacyPeriodMatches = creditPeriodAction(rows[0].period_key, args.periodKey) === "keep"
      }
    } catch {
      /* legacy table may lag */
    }
  }

  return {
    usageEvents,
    ledgerUsage,
    legacySpent,
    conversationEstimate,
    periodUsed: (() => {
      const recorded = combinePeriodUsage([usageEvents, ledgerUsage, legacySpent])
      return recorded > 0 ? recorded : conversationEstimate
    })(),
    lifetimeUsed: combinePeriodUsage([lifetimeFromEvents, lifetimeFromLedger, lifetimeLegacy]),
    legacyIncluded,
    legacyPurchased,
    legacyPeriodMatches,
  }
}
