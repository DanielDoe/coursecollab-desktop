import { sql } from "@/lib/db"
import {
  studentMonthlyAllocation,
  type StudentCoraTier,
} from "@/lib/cora/credits/economy"
import { creditPeriodAction, shouldPersistMembershipTier } from "@/lib/cora/credits/period-reset"

let schemaReady = false

export async function ensureStudentCoraCreditsSchema(): Promise<void> {
  if (schemaReady) return
  await sql`
    CREATE TABLE IF NOT EXISTS ai_tutor_credits (
      student_id INTEGER PRIMARY KEY REFERENCES students(id) ON DELETE CASCADE,
      credits INTEGER NOT NULL DEFAULT 0,
      purchased_credits INTEGER NOT NULL DEFAULT 0,
      last_reset_date DATE NOT NULL DEFAULT CURRENT_DATE,
      period_key VARCHAR(16),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `
  await sql`
    ALTER TABLE ai_tutor_credits
    ADD COLUMN IF NOT EXISTS purchased_credits INTEGER NOT NULL DEFAULT 0
  `
  await sql`
    ALTER TABLE ai_tutor_credits
    ADD COLUMN IF NOT EXISTS period_key VARCHAR(16)
  `
  await sql`
    ALTER TABLE ai_tutor_credits
    ADD COLUMN IF NOT EXISTS membership_tier VARCHAR(32)
  `
  await sql`
    CREATE TABLE IF NOT EXISTS ai_tutor_credit_transactions (
      id SERIAL PRIMARY KEY,
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      transaction_type VARCHAR(32) NOT NULL,
      credits INTEGER NOT NULL,
      description TEXT,
      source VARCHAR(64),
      session_id INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `
  schemaReady = true
}

export function currentStudentPeriodKey(now = new Date()): string {
  const y = now.getUTCFullYear()
  const m = String(now.getUTCMonth() + 1).padStart(2, "0")
  return `${y}-${m}`
}

export type StudentCoraBalance = {
  membershipCredits: number
  purchasedCredits: number
  total: number
  periodKey: string
  monthlyAllocation: number
  tier: StudentCoraTier
  isLow: boolean
  mode: "premium" | "lite"
}

async function ensureRow(
  studentId: number,
  allocation: number,
  periodKey: string,
  tier: StudentCoraTier,
) {
  await sql`
    INSERT INTO ai_tutor_credits (student_id, credits, purchased_credits, last_reset_date, period_key, membership_tier)
    VALUES (${studentId}, ${allocation}, 0, CURRENT_DATE, ${periodKey}, ${tier})
    ON CONFLICT (student_id) DO NOTHING
  `
}

/**
 * Monthly membership refresh. Purchased credits never reset here.
 * Consume membership BEFORE purchased at deduct time.
 */
export async function getStudentCoraBalanceForTier(
  studentId: number,
  tier: StudentCoraTier,
): Promise<StudentCoraBalance> {
  await ensureStudentCoraCreditsSchema()
  const allocation = studentMonthlyAllocation(tier)
  const periodKey = currentStudentPeriodKey()

  await ensureRow(studentId, allocation, periodKey, tier)

  const rows = (await sql`
    SELECT credits, purchased_credits, period_key, membership_tier
    FROM ai_tutor_credits
    WHERE student_id = ${studentId}
    LIMIT 1
  `) as Array<{
    credits: number
    purchased_credits: number
    period_key: string | null
    membership_tier: string | null
  }>

  let membership = Number(rows[0]?.credits ?? 0)
  let purchased = Number(rows[0]?.purchased_credits ?? 0)
  const rowPeriod = rows[0]?.period_key ?? null
  const rowTier = rows[0]?.membership_tier ?? null

  const periodAction = creditPeriodAction(rowPeriod, periodKey)
  const needsTierLabel = shouldPersistMembershipTier(rowTier, tier)

  if (periodAction === "period_reset") {
    await sql`
      UPDATE ai_tutor_credits
      SET credits = ${allocation},
          period_key = ${periodKey},
          membership_tier = ${tier},
          last_reset_date = CURRENT_DATE,
          updated_at = CURRENT_TIMESTAMP
      WHERE student_id = ${studentId}
    `
    await sql`
      INSERT INTO ai_tutor_credit_transactions (student_id, transaction_type, credits, description, source)
      VALUES (
        ${studentId},
        'reset',
        ${allocation},
        ${`Monthly Cora credit reset (${tier})`},
        'monthly_reset'
      )
    `
    membership = allocation
  } else if (periodAction === "stamp_period" || needsTierLabel || !rowTier) {
    await sql`
      UPDATE ai_tutor_credits
      SET membership_tier = ${tier},
          period_key = ${periodKey},
          updated_at = CURRENT_TIMESTAMP
      WHERE student_id = ${studentId}
    `
  }

  const total = Math.max(0, membership) + Math.max(0, purchased)
  return {
    membershipCredits: Math.max(0, membership),
    purchasedCredits: Math.max(0, purchased),
    total,
    periodKey,
    monthlyAllocation: allocation,
    tier,
    isLow: allocation > 0 && membership / allocation <= 0.25 && total > 0,
    mode: total > 0 ? "premium" : "lite",
  }
}

export async function deductStudentCoraCredits(
  studentId: number,
  creditsUsed: number,
  tier: StudentCoraTier,
  opts?: { sessionId?: number; description?: string; source?: string },
): Promise<boolean> {
  if (!Number.isFinite(creditsUsed) || creditsUsed <= 0) return true

  const bal = await getStudentCoraBalanceForTier(studentId, tier)
  if (bal.total < creditsUsed) return false

  const fromMembership = Math.min(bal.membershipCredits, creditsUsed)
  const fromPurchased = creditsUsed - fromMembership

  const updated = (await sql`
    UPDATE ai_tutor_credits
    SET credits = GREATEST(0, credits - ${fromMembership}),
        purchased_credits = GREATEST(0, purchased_credits - ${fromPurchased}),
        updated_at = CURRENT_TIMESTAMP
    WHERE student_id = ${studentId}
      AND (credits + purchased_credits) >= ${creditsUsed}
    RETURNING student_id
  `) as Array<{ student_id: number }>
  if (updated.length === 0) return false

  await sql`
    INSERT INTO ai_tutor_credit_transactions (student_id, transaction_type, credits, description, source, session_id)
    VALUES (
      ${studentId},
      'spent',
      ${creditsUsed},
      ${opts?.description ?? "Cora usage"},
      ${opts?.source ?? "usage"},
      ${opts?.sessionId ?? null}
    )
  `

  return true
}

export async function addPurchasedStudentCoraCredits(
  studentId: number,
  credits: number,
  tier: StudentCoraTier,
  description = "Purchased Cora Credit Pack",
): Promise<void> {
  await ensureStudentCoraCreditsSchema()
  const periodKey = currentStudentPeriodKey()
  const allocation = studentMonthlyAllocation(tier)
  await ensureRow(studentId, allocation, periodKey, tier)
  await sql`
    UPDATE ai_tutor_credits
    SET purchased_credits = purchased_credits + ${credits},
        updated_at = CURRENT_TIMESTAMP
    WHERE student_id = ${studentId}
  `
  await sql`
    INSERT INTO ai_tutor_credit_transactions (student_id, transaction_type, credits, description, source)
    VALUES (${studentId}, 'purchase', ${credits}, ${description}, 'purchase')
  `
}
