import { sql } from "@/lib/db"
import { getInstructorMembership } from "@/lib/instructor-membership"
import { resolveAcademicTerm, resolveAcademicEndYear } from "@/lib/membership-constants"
import {
  instructorPeriodAllocation,
  type InstructorCoraTier,
} from "@/lib/cora/credits/economy"
import { creditPeriodAction } from "@/lib/cora/credits/period-reset"

let schemaReady = false

export async function ensureInstructorCoraCreditsSchema(): Promise<void> {
  if (schemaReady) return
  await sql`
    CREATE TABLE IF NOT EXISTS instructor_cora_credits (
      instructor_id INTEGER PRIMARY KEY REFERENCES instructors(id) ON DELETE CASCADE,
      membership_credits INTEGER NOT NULL DEFAULT 0,
      purchased_credits INTEGER NOT NULL DEFAULT 0,
      period_key VARCHAR(32) NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS instructor_cora_credit_transactions (
      id SERIAL PRIMARY KEY,
      instructor_id INTEGER NOT NULL REFERENCES instructors(id) ON DELETE CASCADE,
      transaction_type VARCHAR(32) NOT NULL,
      credits INTEGER NOT NULL,
      description TEXT,
      source VARCHAR(64),
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `
  schemaReady = true
}

export function currentInstructorPeriodKey(
  cadence: "semester" | "annual" | null | undefined,
  now = new Date(),
): string {
  if (cadence === "annual") {
    return `annual-${now.getUTCFullYear()}`
  }
  const term = resolveAcademicTerm()
  const year = resolveAcademicEndYear()
  return `${year}-${term}`
}

export type InstructorCoraBalance = {
  membershipCredits: number
  purchasedCredits: number
  total: number
  periodKey: string
  periodAllocation: number
  tier: InstructorCoraTier
  isLow: boolean
  mode: "premium" | "lite"
}

export async function getInstructorCoraBalance(instructorId: number): Promise<InstructorCoraBalance> {
  await ensureInstructorCoraCreditsSchema()
  const membership = await getInstructorMembership(instructorId)
  const storedTier = membership?.storedTier ?? membership?.tier ?? "Free"
  const tier = (membership?.tier ?? "Free") as InstructorCoraTier
  const cadence = membership?.membership?.billingCadence ?? "semester"
  const allocation = instructorPeriodAllocation(storedTier, cadence)
  const periodKey = currentInstructorPeriodKey(cadence)

  await sql`
    INSERT INTO instructor_cora_credits (instructor_id, membership_credits, purchased_credits, period_key)
    VALUES (${instructorId}, ${allocation}, 0, ${periodKey})
    ON CONFLICT (instructor_id) DO NOTHING
  `

  const rows = (await sql`
    SELECT membership_credits, purchased_credits, period_key
    FROM instructor_cora_credits
    WHERE instructor_id = ${instructorId}
    LIMIT 1
  `) as Array<{
    membership_credits: number
    purchased_credits: number
    period_key: string | null
  }>

  let membershipCredits = Number(rows[0]?.membership_credits ?? 0)
  let purchased = Number(rows[0]?.purchased_credits ?? 0)
  const rowPeriod = rows[0]?.period_key ?? null

  const periodAction = creditPeriodAction(rowPeriod, periodKey)
  if (periodAction === "period_reset") {
    await sql`
      UPDATE instructor_cora_credits
      SET membership_credits = ${allocation},
          period_key = ${periodKey},
          updated_at = CURRENT_TIMESTAMP
      WHERE instructor_id = ${instructorId}
    `
    await sql`
      INSERT INTO instructor_cora_credit_transactions (instructor_id, transaction_type, credits, description, source)
      VALUES (
        ${instructorId},
        'reset',
        ${allocation},
        ${`Period Cora credit reset (${tier}/${cadence})`},
        'period_reset'
      )
    `
    membershipCredits = allocation
  } else if (periodAction === "stamp_period") {
    await sql`
      UPDATE instructor_cora_credits
      SET period_key = ${periodKey},
          updated_at = CURRENT_TIMESTAMP
      WHERE instructor_id = ${instructorId}
    `
  }

  const total = Math.max(0, membershipCredits) + Math.max(0, purchased)
  return {
    membershipCredits: Math.max(0, membershipCredits),
    purchasedCredits: Math.max(0, purchased),
    total,
    periodKey,
    periodAllocation: allocation,
    tier,
    isLow: allocation > 0 && membershipCredits / allocation <= 0.2 && total > 0,
    mode: total > 0 ? "premium" : "lite",
  }
}

export async function deductInstructorCoraCredits(
  instructorId: number,
  creditsUsed: number,
  opts?: { description?: string; source?: string },
): Promise<boolean> {
  if (!Number.isFinite(creditsUsed) || creditsUsed <= 0) return true

  try {
    const { tryDebitInstitutionCora } = await import("@/lib/institutions/cora")
    // Campus pool is additional accounting — do not skip the faculty period cap.
    await tryDebitInstitutionCora({
      userType: "instructor",
      userId: instructorId,
      credits: creditsUsed,
      workflowType: opts?.source ?? "faculty_cora",
    })
  } catch {
    /* no institutional pool */
  }

  await ensureInstructorCoraCreditsSchema()
  const bal = await getInstructorCoraBalance(instructorId)
  if (bal.total < creditsUsed) return false

  const fromMembership = Math.min(bal.membershipCredits, creditsUsed)
  const fromPurchased = creditsUsed - fromMembership

  await sql`
    UPDATE instructor_cora_credits
    SET membership_credits = GREATEST(0, membership_credits - ${fromMembership}),
        purchased_credits = GREATEST(0, purchased_credits - ${fromPurchased}),
        updated_at = CURRENT_TIMESTAMP
    WHERE instructor_id = ${instructorId}
  `

  await sql`
    INSERT INTO instructor_cora_credit_transactions (instructor_id, transaction_type, credits, description, source)
    VALUES (
      ${instructorId},
      'spent',
      ${creditsUsed},
      ${opts?.description ?? "Cora usage"},
      ${opts?.source ?? "usage"}
    )
  `

  return true
}
