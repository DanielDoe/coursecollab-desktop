import { sql } from "@/lib/db"
import {
  getGuestAccessPlan,
  getGuestCoraCreditPack,
  guestPlanHasCareerUnlock,
  type GuestCareerPaidPlanId,
} from "@/lib/guest/membership-config"
import type { GuestPlan } from "@/lib/guest/types"
import { ensureGuestEntitlementsSchema, getGuestEntitlement } from "@/lib/guest/entitlements"
import { grantGuestCredits, ensureGuestCreditLedgerSchema } from "@/lib/guest/cora-credit-ledger"

async function recordPurchase(args: {
  studentId: number
  productType: "LIFETIME_ACCESS" | "CORA_CREDIT_PACK"
  productId: string
  stripeSessionId: string
  amountCents: number
  currency?: string
}): Promise<boolean> {
  await ensureGuestCreditLedgerSchema()
  const existing = (await sql`
    SELECT id FROM guest_purchases WHERE stripe_session_id = ${args.stripeSessionId} LIMIT 1
  `) as Array<{ id: number }>
  if (existing.length > 0) return false

  await sql`
    INSERT INTO guest_purchases (
      student_id, product_type, product_id, stripe_session_id,
      amount_cents, currency, status
    ) VALUES (
      ${args.studentId},
      ${args.productType},
      ${args.productId},
      ${args.stripeSessionId},
      ${args.amountCents},
      ${args.currency ?? "usd"},
      'completed'
    )
  `
  return true
}

function creditsToGrantOnUnlock(args: {
  targetPlan: GuestCareerPaidPlanId
  existingPlan: GuestPlan | null
}): number {
  const targetCfg = getGuestAccessPlan(args.targetPlan)
  if (!args.existingPlan || !guestPlanHasCareerUnlock(args.existingPlan)) {
    return targetCfg.coraCreditsIncluded
  }
  if (args.existingPlan === "cora_career") return 0
  if (args.existingPlan === "cora_career_essentials" && args.targetPlan === "cora_career") {
    const essentialsCfg = getGuestAccessPlan("cora_career_essentials")
    return Math.max(0, targetCfg.coraCreditsIncluded - essentialsCfg.coraCreditsIncluded)
  }
  return 0
}

/** Lifetime Cora Career unlock — Essentials or Lifetime; upgrades Essentials → Lifetime. */
export async function fulfillGuestCareerPlanPurchase(args: {
  stripeSessionId: string
  studentId: number
  plan: GuestCareerPaidPlanId
  amountCents: number
  currency?: string
}): Promise<{ ok: boolean; alreadyFulfilled?: boolean; error?: string }> {
  await ensureGuestEntitlementsSchema()

  const guestRows = await sql`
    SELECT id FROM students
    WHERE id = ${args.studentId} AND COALESCE(is_platform_guest, false) = true
    LIMIT 1
  `
  if (guestRows.length === 0) return { ok: false, error: "Not a Career Member account" }

  const productId =
    args.plan === "cora_career" ? "cora_career_lifetime" : "cora_career_essentials"

  const inserted = await recordPurchase({
    studentId: args.studentId,
    productType: "LIFETIME_ACCESS",
    productId,
    stripeSessionId: args.stripeSessionId,
    amountCents: args.amountCents,
    currency: args.currency,
  })
  if (!inserted) return { ok: true, alreadyFulfilled: true }

  const existing = await getGuestEntitlement(args.studentId)
  const existingPlan =
    existing?.status === "active" ? (existing.plan as GuestPlan) : null
  const cfg = getGuestAccessPlan(args.plan)
  const grantAmount = creditsToGrantOnUnlock({
    targetPlan: args.plan,
    existingPlan,
  })

  await sql`
    INSERT INTO guest_entitlements (student_id, plan, status, starts_at, expires_at, cora_credit_limit)
    VALUES (${args.studentId}, ${args.plan}, 'active', NOW(), NULL, ${cfg.coraCreditsIncluded})
    ON CONFLICT (student_id) DO UPDATE SET
      plan = ${args.plan},
      status = 'active',
      expires_at = NULL,
      cora_credit_limit = ${cfg.coraCreditsIncluded},
      updated_at = NOW()
  `

  if (grantAmount > 0) {
    await grantGuestCredits(args.studentId, "LIFETIME_PURCHASE_GRANT", grantAmount, {
      source: "lifetime_purchase",
      sourceReference: args.stripeSessionId,
    })
  }

  return { ok: true }
}

/** @deprecated use fulfillGuestCareerPlanPurchase */
export async function fulfillGuestCoraCareerLifetime(args: {
  stripeSessionId: string
  studentId: number
  amountCents: number
  currency?: string
}): Promise<{ ok: boolean; alreadyFulfilled?: boolean; error?: string }> {
  return fulfillGuestCareerPlanPurchase({
    ...args,
    plan: "cora_career",
  })
}

/** @deprecated alias */
export const fulfillGuestCoraCareerPurchase = fulfillGuestCoraCareerLifetime

export async function fulfillGuestCreditPackPurchase(args: {
  stripeSessionId: string
  studentId: number
  packId: string
  amountCents: number
  currency?: string
}): Promise<{ ok: boolean; alreadyFulfilled?: boolean; error?: string }> {
  const pack = getGuestCoraCreditPack(args.packId)
  if (!pack) return { ok: false, error: "Unknown pack" }

  const guestRows = await sql`
    SELECT id FROM students
    WHERE id = ${args.studentId} AND COALESCE(is_platform_guest, false) = true
    LIMIT 1
  `
  if (guestRows.length === 0) return { ok: false, error: "Not a Career Member account" }

  const inserted = await recordPurchase({
    studentId: args.studentId,
    productType: "CORA_CREDIT_PACK",
    productId: pack.id,
    stripeSessionId: args.stripeSessionId,
    amountCents: args.amountCents,
    currency: args.currency,
  })
  if (!inserted) return { ok: true, alreadyFulfilled: true }

  await grantGuestCredits(args.studentId, "CREDIT_PACK_PURCHASE", pack.credits, {
    source: "credit_pack",
    sourceReference: args.stripeSessionId,
  })

  return { ok: true }
}
