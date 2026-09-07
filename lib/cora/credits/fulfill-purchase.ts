import { sql } from "@/lib/db"
import { getCoraPack, type CoraCreditPack } from "@/lib/cora/credits/packs"
import { studentMonthlyAllocation, type StudentCoraTier } from "@/lib/cora/credits/economy"
import {
  addPurchasedStudentCoraCredits,
  ensureStudentCoraCreditsSchema,
  currentStudentPeriodKey,
} from "@/lib/cora/credits/student-ledger"
import {
  ensureInstructorCoraCreditsSchema,
  getInstructorCoraBalance,
} from "@/lib/cora/credits/instructor-ledger"
import { STRIPE_STUDENT_CREDIT_PACKS } from "@/lib/stripe"

let purchaseSchemaReady = false

export async function ensureCoraPurchaseSchema(): Promise<void> {
  if (purchaseSchemaReady) return
  await sql`
    CREATE TABLE IF NOT EXISTS cora_credit_purchases (
      id SERIAL PRIMARY KEY,
      stripe_session_id TEXT UNIQUE NOT NULL,
      audience VARCHAR(16) NOT NULL,
      buyer_id INTEGER NOT NULL,
      pack_id VARCHAR(64) NOT NULL,
      credits INTEGER NOT NULL,
      amount_cents INTEGER NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `
  await sql`
    CREATE INDEX IF NOT EXISTS cora_credit_purchases_buyer_idx
    ON cora_credit_purchases (audience, buyer_id, created_at DESC)
  `
  purchaseSchemaReady = true
}

export async function addPurchasedInstructorCoraCredits(
  instructorId: number,
  credits: number,
  description = "Purchased Cora Credit Pack",
): Promise<void> {
  await ensureInstructorCoraCreditsSchema()
  // Ensure row exists via balance helper
  await getInstructorCoraBalance(instructorId)
  await sql`
    UPDATE instructor_cora_credits
    SET purchased_credits = purchased_credits + ${credits},
        updated_at = CURRENT_TIMESTAMP
    WHERE instructor_id = ${instructorId}
  `
  await sql`
    INSERT INTO instructor_cora_credit_transactions (instructor_id, transaction_type, credits, description, source)
    VALUES (${instructorId}, 'purchase', ${credits}, ${description}, 'purchase')
  `
}

/**
 * Fulfill a Stripe checkout for a Cora Credit Pack (idempotent on session id).
 */
export async function fulfillCoraCreditPackPurchase(args: {
  stripeSessionId: string
  audience: "student" | "instructor"
  buyerId: number
  packId: string
  amountCents?: number
  studentTier?: StudentCoraTier
}): Promise<{ ok: boolean; alreadyFulfilled?: boolean; credits?: number; error?: string }> {
  await ensureCoraPurchaseSchema()
  const pack = getCoraPack(args.packId)
  if (!pack || pack.audience !== args.audience) {
    return { ok: false, error: "Unknown pack" }
  }

  const existing = (await sql`
    SELECT id FROM cora_credit_purchases
    WHERE stripe_session_id = ${args.stripeSessionId}
    LIMIT 1
  `) as Array<{ id: number }>
  if (existing.length > 0) {
    return { ok: true, alreadyFulfilled: true, credits: pack.credits }
  }

  if (args.audience === "student") {
    const tier = args.studentTier ?? "Scholar"
    await ensureStudentCoraCreditsSchema()
    // Ensure row for period
    const periodKey = currentStudentPeriodKey()
    const allocation = studentMonthlyAllocation(tier)
    await sql`
      INSERT INTO ai_tutor_credits (student_id, credits, purchased_credits, last_reset_date, period_key, membership_tier)
      VALUES (${args.buyerId}, ${allocation}, 0, CURRENT_DATE, ${periodKey}, ${tier})
      ON CONFLICT (student_id) DO NOTHING
    `
    await addPurchasedStudentCoraCredits(
      args.buyerId,
      pack.credits,
      tier,
      `Purchased ${pack.name}`,
    )
    try {
      const { addPurchasedCredits, migrateOpeningBalanceFromLegacy } = await import("@/lib/cora/ai")
      await migrateOpeningBalanceFromLegacy({
        userId: args.buyerId,
        userRole: "student",
        membershipTier: tier,
      })
      await addPurchasedCredits({
        userId: args.buyerId,
        userRole: "student",
        credits: pack.credits,
        purchaseId: args.stripeSessionId,
        description: `Purchased ${pack.name}`,
        membershipTier: tier,
      })
    } catch (err) {
      console.warn("[fulfill] new ledger purchase sync failed", err)
    }
  } else {
    await addPurchasedInstructorCoraCredits(args.buyerId, pack.credits, `Purchased ${pack.name}`)
    try {
      const { addPurchasedCredits, migrateOpeningBalanceFromLegacy } = await import("@/lib/cora/ai")
      await migrateOpeningBalanceFromLegacy({
        userId: args.buyerId,
        userRole: "instructor",
      })
      await addPurchasedCredits({
        userId: args.buyerId,
        userRole: "instructor",
        credits: pack.credits,
        purchaseId: args.stripeSessionId,
        description: `Purchased ${pack.name}`,
      })
    } catch (err) {
      console.warn("[fulfill] new ledger purchase sync failed", err)
    }
  }

  try {
    await sql`
      INSERT INTO cora_credit_purchases (
        stripe_session_id, audience, buyer_id, pack_id, credits, amount_cents
      ) VALUES (
        ${args.stripeSessionId},
        ${args.audience},
        ${args.buyerId},
        ${pack.id},
        ${pack.credits},
        ${args.amountCents ?? pack.priceInCents}
      )
    `
  } catch (e) {
    // Unique race — treat as already fulfilled
    const msg = e instanceof Error ? e.message : String(e)
    if (/unique|duplicate/i.test(msg)) {
      return { ok: true, alreadyFulfilled: true, credits: pack.credits }
    }
    throw e
  }

  return { ok: true, credits: pack.credits }
}

export function packLineItem(pack: CoraCreditPack) {
  const configuredId =
    pack.audience === "student"
      ? STRIPE_STUDENT_CREDIT_PACKS[pack.id as keyof typeof STRIPE_STUDENT_CREDIT_PACKS]
      : ""
  if (configuredId?.startsWith("price_")) {
    return { price: configuredId, quantity: 1 }
  }

  return {
    quantity: 1,
    price_data: {
      currency: "usd" as const,
      unit_amount: pack.priceInCents,
      product_data: {
        name: pack.name,
        description: `${pack.credits.toLocaleString()} Cora Credits — ${pack.description}`,
        metadata: {
          pack_id: pack.id,
          cora_credits: String(pack.credits),
        },
      },
    },
  }
}
