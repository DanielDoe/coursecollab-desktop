import { sql } from "@/lib/db"
import { getGuestAccessPlan, resolveGuestCoraBalanceLevel, guestPlanHasCareerUnlock, type GuestCoraBalanceLevel } from "@/lib/guest/membership-config"
import type { GuestPlan } from "@/lib/guest/types"
import { getGuestEntitlement } from "@/lib/guest/entitlements"

export type GuestCreditLedgerType =
  | "STARTER_GRANT"
  | "LIFETIME_PURCHASE_GRANT"
  | "CREDIT_PACK_PURCHASE"
  | "AI_USAGE"
  | "REFUND"
  | "ADMIN_ADJUSTMENT"
  | "PROMOTIONAL_GRANT"
  | "RESERVATION_HOLD"
  | "RESERVATION_RELEASE"

let schemaReady: Promise<void> | null = null

export async function ensureGuestCreditLedgerSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS guest_cora_credit_ledger (
          id SERIAL PRIMARY KEY,
          student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
          transaction_type VARCHAR(40) NOT NULL,
          amount INTEGER NOT NULL,
          balance_after INTEGER NOT NULL,
          source VARCHAR(64),
          source_reference TEXT,
          feature VARCHAR(64),
          metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `
      await sql`
        CREATE INDEX IF NOT EXISTS idx_guest_cora_ledger_student_created
        ON guest_cora_credit_ledger (student_id, created_at DESC)
      `
      await sql`
        CREATE TABLE IF NOT EXISTS guest_cora_balances (
          student_id INTEGER PRIMARY KEY REFERENCES students(id) ON DELETE CASCADE,
          balance INTEGER NOT NULL DEFAULT 0,
          reserved INTEGER NOT NULL DEFAULT 0,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `
      await sql`
        CREATE TABLE IF NOT EXISTS guest_purchases (
          id SERIAL PRIMARY KEY,
          student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
          product_type VARCHAR(32) NOT NULL,
          product_id VARCHAR(64) NOT NULL,
          stripe_session_id TEXT UNIQUE NOT NULL,
          amount_cents INTEGER NOT NULL,
          currency VARCHAR(8) NOT NULL DEFAULT 'usd',
          status VARCHAR(20) NOT NULL DEFAULT 'completed',
          purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `
    })()
  }
  await schemaReady
}

export type GuestCoraBalance = {
  balance: number
  reserved: number
  available: number
  plan: GuestPlan
  coraCareerLifetime: boolean
  isLow: boolean
  balanceLevel: GuestCoraBalanceLevel
}

async function ensureBalanceRow(studentId: number): Promise<number> {
  await sql`
    INSERT INTO guest_cora_balances (student_id, balance, reserved)
    VALUES (${studentId}, 0, 0)
    ON CONFLICT (student_id) DO NOTHING
  `
  const rows = (await sql`
    SELECT balance FROM guest_cora_balances WHERE student_id = ${studentId} LIMIT 1
  `) as Array<{ balance: number }>
  return Number(rows[0]?.balance ?? 0)
}

async function appendLedgerEntry(args: {
  studentId: number
  transactionType: GuestCreditLedgerType
  amount: number
  source?: string | null
  sourceReference?: string | null
  feature?: string | null
  metadata?: Record<string, unknown>
}): Promise<number> {
  await ensureGuestCreditLedgerSchema()
  const current = await ensureBalanceRow(args.studentId)
  const next = current + args.amount
  if (next < 0) throw new Error("Insufficient Cora Credits")

  await sql`
    UPDATE guest_cora_balances
    SET balance = ${next}, updated_at = NOW()
    WHERE student_id = ${args.studentId}
  `

  await sql`
    INSERT INTO guest_cora_credit_ledger (
      student_id, transaction_type, amount, balance_after,
      source, source_reference, feature, metadata
    ) VALUES (
      ${args.studentId},
      ${args.transactionType},
      ${args.amount},
      ${next},
      ${args.source ?? null},
      ${args.sourceReference ?? null},
      ${args.feature ?? null},
      ${JSON.stringify(args.metadata ?? {})}::jsonb
    )
  `

  return next
}

export async function getGuestCoraBalance(studentId: number): Promise<GuestCoraBalance> {
  await ensureGuestCreditLedgerSchema()
  const entitlement = await getGuestEntitlement(studentId)
  const plan: GuestPlan =
    entitlement?.status === "active" && guestPlanHasCareerUnlock(entitlement.plan as GuestPlan)
      ? (entitlement.plan as GuestPlan)
      : "guest_free"
  const cfg = getGuestAccessPlan(plan)

  const balRows = (await sql`
    SELECT balance, reserved FROM guest_cora_balances WHERE student_id = ${studentId} LIMIT 1
  `) as Array<{ balance: number; reserved: number }>

  if (balRows.length === 0) {
    await grantGuestCredits(studentId, "STARTER_GRANT", cfg.coraCreditsIncluded, {
      source: "starter",
      sourceReference: plan,
    })
    return getGuestCoraBalance(studentId)
  }

  const balance = Number(balRows[0]!.balance ?? 0)
  const reserved = Number(balRows[0]!.reserved ?? 0)

  const ledgerRows = (await sql`
    SELECT id FROM guest_cora_credit_ledger WHERE student_id = ${studentId} LIMIT 1
  `) as Array<{ id: number }>
  if (ledgerRows.length === 0 && balance > 0) {
    await backfillGuestCreditLedgerForStudent(studentId)
  }

  const available = Math.max(0, balance - reserved)
  const balanceLevel = resolveGuestCoraBalanceLevel(available, plan)
  const isLow = balanceLevel === "low" || balanceLevel === "critical"

  return {
    balance,
    reserved,
    available,
    plan,
    coraCareerLifetime: guestPlanHasCareerUnlock(plan),
    isLow,
    balanceLevel,
  }
}

export async function grantGuestCredits(
  studentId: number,
  transactionType: Extract<
    GuestCreditLedgerType,
    "STARTER_GRANT" | "LIFETIME_PURCHASE_GRANT" | "CREDIT_PACK_PURCHASE" | "PROMOTIONAL_GRANT" | "ADMIN_ADJUSTMENT" | "REFUND"
  >,
  credits: number,
  opts?: { source?: string; sourceReference?: string; feature?: string },
): Promise<number> {
  if (credits <= 0) return (await getGuestCoraBalance(studentId)).balance
  return appendLedgerEntry({
    studentId,
    transactionType,
    amount: credits,
    source: opts?.source ?? null,
    sourceReference: opts?.sourceReference ?? null,
    feature: opts?.feature ?? null,
  })
}

export async function deductGuestCoraCredits(
  studentId: number,
  credits: number,
  description: string,
  feature?: string,
): Promise<{ ok: boolean; remaining: number }> {
  if (credits <= 0) {
    const bal = await getGuestCoraBalance(studentId)
    return { ok: true, remaining: bal.available }
  }

  const bal = await getGuestCoraBalance(studentId)
  if (bal.available < credits) return { ok: false, remaining: bal.available }

  const remaining = await appendLedgerEntry({
    studentId,
    transactionType: "AI_USAGE",
    amount: -credits,
    source: "usage",
    sourceReference: description,
    feature: feature ?? null,
  })

  return { ok: true, remaining: Math.max(0, remaining - bal.reserved) }
}

export async function reserveGuestCoraCredits(
  studentId: number,
  credits: number,
): Promise<{ ok: boolean; remaining: number }> {
  await ensureGuestCreditLedgerSchema()
  const bal = await getGuestCoraBalance(studentId)
  if (bal.available < credits) return { ok: false, remaining: bal.available }

  await sql`
    UPDATE guest_cora_balances
    SET reserved = reserved + ${credits}, updated_at = NOW()
    WHERE student_id = ${studentId}
  `

  const after = await getGuestCoraBalance(studentId)
  return { ok: true, remaining: after.available }
}

export async function releaseGuestCoraReservation(studentId: number, credits: number): Promise<void> {
  await ensureGuestCreditLedgerSchema()
  await sql`
    UPDATE guest_cora_balances
    SET reserved = GREATEST(0, reserved - ${credits}), updated_at = NOW()
    WHERE student_id = ${studentId}
  `
}

/** Insert ledger row without mutating balance (audit backfill). */
async function insertGuestLedgerAuditOnly(args: {
  studentId: number
  transactionType: GuestCreditLedgerType
  amount: number
  balanceAfter: number
  source?: string | null
  sourceReference?: string | null
  feature?: string | null
  metadata?: Record<string, unknown>
}): Promise<void> {
  await ensureGuestCreditLedgerSchema()
  await sql`
    INSERT INTO guest_cora_credit_ledger (
      student_id, transaction_type, amount, balance_after,
      source, source_reference, feature, metadata
    ) VALUES (
      ${args.studentId},
      ${args.transactionType},
      ${args.amount},
      ${args.balanceAfter},
      ${args.source ?? null},
      ${args.sourceReference ?? null},
      ${args.feature ?? null},
      ${JSON.stringify(args.metadata ?? { backfill: true })}::jsonb
    )
  `
}

/** Backfill STARTER_GRANT ledger rows for guests with balance but no ledger history. */
export async function backfillGuestCreditLedgerForStudent(studentId: number): Promise<boolean> {
  await ensureGuestCreditLedgerSchema()
  const existing = (await sql`
    SELECT id FROM guest_cora_credit_ledger WHERE student_id = ${studentId} LIMIT 1
  `) as Array<{ id: number }>
  if (existing.length > 0) return false

  const balRows = (await sql`
    SELECT balance FROM guest_cora_balances WHERE student_id = ${studentId} LIMIT 1
  `) as Array<{ balance: number }>
  const balance = Number(balRows[0]?.balance ?? 0)
  if (balance <= 0) return false

  const entitlement = await getGuestEntitlement(studentId)
  const rawPlan = entitlement?.plan as GuestPlan | undefined
  const plan =
    entitlement?.status === "active" && rawPlan && guestPlanHasCareerUnlock(rawPlan)
      ? rawPlan
      : "guest_free"
  const txType = guestPlanHasCareerUnlock(plan) ? "LIFETIME_PURCHASE_GRANT" : "STARTER_GRANT"

  await insertGuestLedgerAuditOnly({
    studentId,
    transactionType: txType,
    amount: balance,
    balanceAfter: balance,
    source: "backfill",
    sourceReference: plan,
    metadata: { reason: "migration_balance_without_ledger" },
  })
  return true
}

export async function backfillAllGuestCreditLedgers(): Promise<{ backfilled: number; skipped: number }> {
  await ensureGuestCreditLedgerSchema()
  const guests = (await sql`
    SELECT id FROM students WHERE COALESCE(is_platform_guest, false) = true
  `) as Array<{ id: number }>

  let backfilled = 0
  let skipped = 0
  for (const g of guests) {
    const did = await backfillGuestCreditLedgerForStudent(Number(g.id))
    if (did) backfilled++
    else skipped++
  }
  return { backfilled, skipped }
}
