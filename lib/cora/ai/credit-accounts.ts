import { sql } from "@/lib/db"
import { ensureCoraAiAccountingSchema } from "@/lib/cora/ai/schema"
import type { CoraUserRole } from "@/lib/cora/ai/types"
import {
  studentMonthlyAllocation,
  instructorPeriodAllocation,
  type StudentCoraTier,
  type InstructorCoraTier,
} from "@/lib/cora/credits/economy"
import { currentStudentPeriodKey } from "@/lib/cora/credits/student-ledger"
import { currentInstructorPeriodKey } from "@/lib/cora/credits/instructor-ledger"
import {
  creditPeriodAction,
  shouldPersistMembershipTier,
} from "@/lib/cora/credits/period-reset"

export type CoraCreditAccountSnapshot = {
  userId: number
  userRole: CoraUserRole
  membershipTier: string | null
  includedBalance: number
  purchasedBalance: number
  reservedCredits: number
  available: number
  periodKey: string
  lifetimeCreditsUsed: number
  lowBalanceFraction: number
}

function periodBounds(periodKey: string): { start: Date; end: Date } {
  // student: YYYY-MM ; faculty: YYYY-spring|fall or annual-YYYY
  if (/^\d{4}-\d{2}$/.test(periodKey)) {
    const [y, m] = periodKey.split("-").map(Number)
    const start = new Date(Date.UTC(y!, m! - 1, 1))
    const end = new Date(Date.UTC(y!, m!, 1))
    return { start, end }
  }
  if (periodKey.startsWith("annual-")) {
    const y = Number(periodKey.slice(7))
    return { start: new Date(Date.UTC(y, 0, 1)), end: new Date(Date.UTC(y + 1, 0, 1)) }
  }
  // semester-ish
  const now = new Date()
  const start = new Date(now)
  start.setMonth(start.getMonth() - 5)
  const end = new Date(now)
  end.setMonth(end.getMonth() + 1)
  return { start, end }
}

export async function ensureCreditAccount(args: {
  userId: number
  userRole: CoraUserRole
  membershipTier?: string | null
  billingCadence?: "semester" | "annual" | null
}): Promise<CoraCreditAccountSnapshot> {
  await ensureCoraAiAccountingSchema()

  const requestedTier = args.membershipTier ?? null
  let periodKey: string
  if (args.userRole === "student") {
    periodKey = currentStudentPeriodKey()
  } else if (args.userRole === "instructor") {
    periodKey = currentInstructorPeriodKey(args.billingCadence ?? "semester")
  } else {
    periodKey = currentStudentPeriodKey()
  }

  const { start, end } = periodBounds(periodKey)

  const initialAllocation =
    args.userRole === "student"
      ? studentMonthlyAllocation((requestedTier as StudentCoraTier) || "Scholar")
      : args.userRole === "instructor"
        ? instructorPeriodAllocation(
            (requestedTier as InstructorCoraTier) || "Free",
            args.billingCadence ?? "semester",
          )
        : Number(process.env.CORA_ADMIN_MONTHLY_SOFT_LIMIT ?? 50000)

  await sql`
    INSERT INTO cora_credit_accounts (
      user_id, user_role, membership_tier, included_balance, purchased_balance,
      reserved_credits, period_key, period_start, period_end
    ) VALUES (
      ${args.userId}, ${args.userRole}, ${requestedTier}, ${initialAllocation}, 0, 0,
      ${periodKey}, ${start.toISOString()}, ${end.toISOString()}
    )
    ON CONFLICT (user_role, user_id) DO NOTHING
  `

  const rows = (await sql`
    SELECT * FROM cora_credit_accounts
    WHERE user_role = ${args.userRole} AND user_id = ${args.userId}
    LIMIT 1
  `) as Array<Record<string, unknown>>

  let row = rows[0]
  if (!row) {
    throw new Error("Failed to create Cora credit account")
  }

  const rowPeriod = String(row.period_key ?? "")
  const rowTier = row.membership_tier == null ? null : String(row.membership_tier)
  // Prefer the caller-provided tier; fall back to stored tier so callers that omit
  // membershipTier don't accidentally re-allocate as Scholar.
  const effectiveTier = requestedTier ?? rowTier
  let allocation = 0
  if (args.userRole === "student") {
    allocation = studentMonthlyAllocation((effectiveTier as StudentCoraTier) || "Scholar")
  } else if (args.userRole === "instructor") {
    allocation = instructorPeriodAllocation(
      (effectiveTier as InstructorCoraTier) || "Free",
      args.billingCadence ?? "semester",
    )
  } else {
    allocation = Number(process.env.CORA_ADMIN_MONTHLY_SOFT_LIMIT ?? 50000)
  }

  const periodAction = creditPeriodAction(rowPeriod, periodKey)
  const persistTier = requestedTier ?? rowTier
  const needsTierLabel = shouldPersistMembershipTier(rowTier, persistTier)

  // Only a real period-key change refills included credits. Tier flaps and
  // over-allocation caps used to rewrite the pot mid-month and erase usage.
  if (periodAction === "period_reset") {
    const reason = `Period reset ${periodKey}`
    await sql`
      UPDATE cora_credit_accounts SET
        included_balance = ${allocation},
        reserved_credits = 0,
        membership_tier = ${persistTier},
        period_key = ${periodKey},
        period_start = ${start.toISOString()},
        period_end = ${end.toISOString()},
        updated_at = CURRENT_TIMESTAMP
      WHERE user_role = ${args.userRole} AND user_id = ${args.userId}
    `
    await sql`
      INSERT INTO cora_credit_transactions (
        user_id, user_role, type, amount, included_delta, purchased_delta, description,
        balance_after_included, balance_after_purchased
      ) VALUES (
        ${args.userId}, ${args.userRole}, 'ALLOCATION', ${allocation}, ${allocation}, 0,
        ${reason}, ${allocation}, ${Number(row.purchased_balance ?? 0)}
      )
    `
    row = {
      ...row,
      included_balance: allocation,
      reserved_credits: 0,
      period_key: periodKey,
      membership_tier: persistTier,
    }

    if (args.userRole === "student") {
      try {
        await sql`
          UPDATE ai_tutor_credits
          SET credits = ${allocation},
              membership_tier = ${persistTier},
              period_key = ${periodKey},
              last_reset_date = CURRENT_DATE,
              updated_at = CURRENT_TIMESTAMP
          WHERE student_id = ${args.userId}
        `
      } catch {
        /* legacy table may lag */
      }
    }
  } else if (periodAction === "stamp_period" || needsTierLabel) {
    await sql`
      UPDATE cora_credit_accounts SET
        membership_tier = ${persistTier},
        period_key = ${periodKey},
        period_start = ${start.toISOString()},
        period_end = ${end.toISOString()},
        updated_at = CURRENT_TIMESTAMP
      WHERE user_role = ${args.userRole} AND user_id = ${args.userId}
    `
    row = {
      ...row,
      period_key: periodKey,
      membership_tier: persistTier,
    }
    if (args.userRole === "student") {
      try {
        await sql`
          UPDATE ai_tutor_credits
          SET membership_tier = ${persistTier},
              period_key = ${periodKey},
              updated_at = CURRENT_TIMESTAMP
          WHERE student_id = ${args.userId}
        `
      } catch {
        /* legacy table may lag */
      }
    }
  }

  const included = Number(row.included_balance ?? 0)
  const purchased = Number(row.purchased_balance ?? 0)
  const reserved = Number(row.reserved_credits ?? 0)
  const available = Math.max(0, included + purchased - reserved)
  const monthlyOrSemester = Math.max(1, allocation)
  return {
    userId: args.userId,
    userRole: args.userRole,
    membershipTier: (row.membership_tier as string | null) ?? effectiveTier,
    includedBalance: included,
    purchasedBalance: purchased,
    reservedCredits: reserved,
    available,
    periodKey: String(row.period_key),
    lifetimeCreditsUsed: Number(row.lifetime_credits_used ?? 0),
    lowBalanceFraction: available / monthlyOrSemester,
  }
}

/** Atomic reserve to prevent concurrent overspend. */
export async function reserveCredits(args: {
  userId: number
  userRole: CoraUserRole
  amount: number
  membershipTier?: string | null
}): Promise<{ ok: boolean; available: number }> {
  if (args.amount <= 0) return { ok: true, available: 0 }
  const snap = await ensureCreditAccount(args)
  if (snap.available < args.amount) {
    return { ok: false, available: snap.available }
  }
  const updated = (await sql`
    UPDATE cora_credit_accounts
    SET reserved_credits = reserved_credits + ${args.amount},
        updated_at = CURRENT_TIMESTAMP
    WHERE user_role = ${args.userRole}
      AND user_id = ${args.userId}
      AND (included_balance + purchased_balance - reserved_credits) >= ${args.amount}
    RETURNING included_balance, purchased_balance, reserved_credits
  `) as Array<Record<string, number>>
  if (updated.length === 0) {
    return { ok: false, available: snap.available }
  }
  const u = updated[0]!
  return {
    ok: true,
    available: Number(u.included_balance) + Number(u.purchased_balance) - Number(u.reserved_credits),
  }
}

export async function releaseReservation(args: {
  userId: number
  userRole: CoraUserRole
  amount: number
}): Promise<void> {
  if (args.amount <= 0) return
  await sql`
    UPDATE cora_credit_accounts
    SET reserved_credits = GREATEST(0, reserved_credits - ${args.amount}),
        updated_at = CURRENT_TIMESTAMP
    WHERE user_role = ${args.userRole} AND user_id = ${args.userId}
  `
}

/**
 * Finalize charge against reservation: consume included first, then purchased.
 * Releases reservation and writes USAGE transaction.
 */
export async function finalizeCreditCharge(args: {
  userId: number
  userRole: CoraUserRole
  reservedAmount: number
  actualCharge: number
  usageEventId?: number | null
  agentRunId?: string | null
  description?: string
  membershipTier?: string | null
}): Promise<{ ok: boolean; charged: number }> {
  await ensureCoraAiAccountingSchema()
  await ensureCreditAccount({
    userId: args.userId,
    userRole: args.userRole,
    membershipTier: args.membershipTier,
  })

  const charge = Math.max(0, Math.floor(args.actualCharge))
  const reserved = Math.max(0, Math.floor(args.reservedAmount))

  if (charge === 0) {
    await releaseReservation({
      userId: args.userId,
      userRole: args.userRole,
      amount: reserved,
    })
    return { ok: true, charged: 0 }
  }

  const rows = (await sql`
    UPDATE cora_credit_accounts AS c
    SET
      reserved_credits = GREATEST(0, c.reserved_credits - ${reserved}),
      included_balance = c.included_balance - sub.from_included,
      purchased_balance = c.purchased_balance - sub.from_purchased,
      lifetime_credits_used = c.lifetime_credits_used + sub.apply,
      updated_at = CURRENT_TIMESTAMP
    FROM (
      SELECT
        LEAST(included_balance, ${charge})::int AS from_included,
        LEAST(purchased_balance, GREATEST(0, ${charge} - included_balance))::int AS from_purchased,
        LEAST(included_balance + purchased_balance, ${charge})::int AS apply
      FROM cora_credit_accounts
      WHERE user_role = ${args.userRole} AND user_id = ${args.userId}
    ) sub
    WHERE c.user_role = ${args.userRole} AND c.user_id = ${args.userId}
    RETURNING c.included_balance, c.purchased_balance, sub.from_included, sub.from_purchased, sub.apply
  `) as Array<{
    included_balance: number
    purchased_balance: number
    from_included: number
    from_purchased: number
    apply: number
  }>

  if (rows.length === 0) return { ok: false, charged: 0 }
  const included = Number(rows[0]!.included_balance)
  const purchased = Number(rows[0]!.purchased_balance)
  const apply = Number(rows[0]!.apply)
  const fromIncluded = Number(rows[0]!.from_included)
  const fromPurchased = Number(rows[0]!.from_purchased)

  await sql`
    INSERT INTO cora_credit_transactions (
      user_id, user_role, type, amount, included_delta, purchased_delta,
      usage_event_id, agent_run_id, description,
      balance_after_included, balance_after_purchased
    ) VALUES (
      ${args.userId}, ${args.userRole}, 'USAGE', ${-apply}, ${-fromIncluded}, ${-fromPurchased},
      ${args.usageEventId ?? null}, ${args.agentRunId ?? null},
      ${args.description ?? "Cora AI usage"},
      ${included}, ${purchased}
    )
  `

  // Keep legacy student/instructor tables in sync for existing UI
  if (args.userRole === "student") {
    try {
      await sql`
        UPDATE ai_tutor_credits
        SET credits = ${included},
            purchased_credits = ${purchased},
            updated_at = CURRENT_TIMESTAMP
        WHERE student_id = ${args.userId}
      `
    } catch {
      /* legacy table may lag */
    }
  } else if (args.userRole === "instructor") {
    try {
      await sql`
        UPDATE instructor_cora_credits
        SET membership_credits = ${included},
            purchased_credits = ${purchased},
            updated_at = CURRENT_TIMESTAMP
        WHERE instructor_id = ${args.userId}
      `
    } catch {
      /* legacy table may lag */
    }
  }

  return { ok: apply === charge, charged: apply }
}

export async function addPurchasedCredits(args: {
  userId: number
  userRole: CoraUserRole
  credits: number
  purchaseId?: string
  description?: string
  membershipTier?: string | null
}): Promise<void> {
  await ensureCreditAccount(args)
  const rows = (await sql`
    UPDATE cora_credit_accounts
    SET purchased_balance = purchased_balance + ${args.credits},
        updated_at = CURRENT_TIMESTAMP
    WHERE user_role = ${args.userRole} AND user_id = ${args.userId}
    RETURNING included_balance, purchased_balance
  `) as Array<{ included_balance: number; purchased_balance: number }>

  const included = Number(rows[0]?.included_balance ?? 0)
  const purchased = Number(rows[0]?.purchased_balance ?? 0)

  await sql`
    INSERT INTO cora_credit_transactions (
      user_id, user_role, type, amount, included_delta, purchased_delta,
      purchase_id, description, balance_after_included, balance_after_purchased
    ) VALUES (
      ${args.userId}, ${args.userRole}, 'PURCHASE', ${args.credits}, 0, ${args.credits},
      ${args.purchaseId ?? null}, ${args.description ?? "Cora Credit Pack"},
      ${included}, ${purchased}
    )
  `
}

/** One-time migration from legacy ai_tutor_credits / instructor_cora_credits. */
export async function migrateOpeningBalanceFromLegacy(args: {
  userId: number
  userRole: "student" | "instructor"
  membershipTier?: string | null
}): Promise<void> {
  await ensureCoraAiAccountingSchema()
  const existing = (await sql`
    SELECT id FROM cora_credit_accounts
    WHERE user_role = ${args.userRole} AND user_id = ${args.userId}
    LIMIT 1
  `) as Array<{ id: number }>
  if (existing.length > 0) return

  let included = 0
  let purchased = 0
  let periodKey = currentStudentPeriodKey()

  if (args.userRole === "student") {
    const rows = (await sql`
      SELECT credits, purchased_credits, period_key FROM ai_tutor_credits
      WHERE student_id = ${args.userId} LIMIT 1
    `) as Array<{ credits: number; purchased_credits: number; period_key: string | null }>
    if (rows[0]) {
      included = Number(rows[0].credits ?? 0)
      purchased = Number(rows[0].purchased_credits ?? 0)
      periodKey = rows[0].period_key || periodKey
    } else {
      included = studentMonthlyAllocation((args.membershipTier as StudentCoraTier) || "Scholar")
    }
  } else {
    periodKey = currentInstructorPeriodKey("semester")
    const rows = (await sql`
      SELECT membership_credits, purchased_credits, period_key FROM instructor_cora_credits
      WHERE instructor_id = ${args.userId} LIMIT 1
    `) as Array<{
      membership_credits: number
      purchased_credits: number
      period_key: string | null
    }>
    if (rows[0]) {
      included = Number(rows[0].membership_credits ?? 0)
      purchased = Number(rows[0].purchased_credits ?? 0)
      periodKey = rows[0].period_key || periodKey
    } else {
      included = instructorPeriodAllocation(
        (args.membershipTier as InstructorCoraTier) || "Free",
        "semester",
      )
    }
  }

  const { start, end } = periodBounds(periodKey)
  await sql`
    INSERT INTO cora_credit_accounts (
      user_id, user_role, membership_tier, included_balance, purchased_balance,
      reserved_credits, period_key, period_start, period_end
    ) VALUES (
      ${args.userId}, ${args.userRole}, ${args.membershipTier ?? null},
      ${included}, ${purchased}, 0, ${periodKey}, ${start.toISOString()}, ${end.toISOString()}
    )
    ON CONFLICT (user_role, user_id) DO NOTHING
  `

  await sql`
    INSERT INTO cora_credit_transactions (
      user_id, user_role, type, amount, included_delta, purchased_delta, description,
      balance_after_included, balance_after_purchased
    ) VALUES (
      ${args.userId}, ${args.userRole}, 'MIGRATION_OPENING_BALANCE',
      ${included + purchased}, ${included}, ${purchased},
      'Migrated from legacy Cora credit tables',
      ${included}, ${purchased}
    )
  `
}
