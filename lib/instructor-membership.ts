import { sql } from "@/lib/db"
import { ensureInstructorMembershipSchema } from "@/lib/ensure-instructor-membership-schema"
import type { InstructorBillingCadence, InstructorMembershipTier } from "@/lib/instructor-membership-constants"
import { normalizeInstructorMembershipTier } from "@/lib/instructor-membership-constants"
import { getSemesterEndDate } from "@/lib/semester-utils"

const TIER_RANK: Record<InstructorMembershipTier, number> = {
  Free: 0,
  Pro: 1,
  Teams: 2,
}

export function instructorTierRank(tier: InstructorMembershipTier): number {
  return TIER_RANK[tier] ?? 0
}

export function resolveHighestInstructorTier(
  current: InstructorMembershipTier,
  incoming: InstructorMembershipTier,
): InstructorMembershipTier {
  return instructorTierRank(incoming) > instructorTierRank(current) ? incoming : current
}

/** Semester licenses expire at active term end; annual covers ~12 months. */
export async function getInstructorMembershipExpiry(
  cadence: InstructorBillingCadence,
): Promise<Date> {
  if (cadence === "annual") {
    const expiry = new Date()
    expiry.setFullYear(expiry.getFullYear() + 1)
    expiry.setHours(23, 59, 59, 999)
    return expiry
  }
  return getSemesterEndDate()
}

export async function getInstructorMembership(instructorId: number) {
  await ensureInstructorMembershipSchema()

  const rows = await sql`
    SELECT
      i.id,
      i.name,
      i.email,
      i.membership_tier,
      i.stripe_customer_id,
      im.id AS membership_row_id,
      im.tier,
      im.plan,
      im.status,
      im.billing_cadence,
      im.expires_at,
      im.end_date,
      im.auto_renew,
      im.start_date,
      im.stripe_checkout_session_id
    FROM instructors i
    LEFT JOIN instructor_memberships im ON im.instructor_id = i.id
    WHERE i.id = ${instructorId}
    LIMIT 1
  `

  if (rows.length === 0) return null

  const row = rows[0]
  const storedTier = String(row.tier ?? row.membership_tier ?? "Free")
  const tier = normalizeInstructorMembershipTier(storedTier) ?? "Free"

  return {
    instructorId: row.id as number,
    name: row.name as string | null,
    email: row.email as string | null,
    storedTier,
    tier,
    stripeCustomerId: (row.stripe_customer_id as string | null) ?? null,
    membership: row.membership_row_id
      ? {
          id: row.membership_row_id as number,
          tier,
          plan: (row.plan as string) ?? tier,
          status: (row.status as string) ?? "active",
          billingCadence: (row.billing_cadence as InstructorBillingCadence | null) ?? null,
          expiresAt: row.expires_at ? new Date(row.expires_at as string) : null,
          endDate: row.end_date ? new Date(row.end_date as string) : null,
          autoRenew: Boolean(row.auto_renew),
          startDate: row.start_date ? new Date(row.start_date as string) : null,
          stripeCheckoutSessionId: (row.stripe_checkout_session_id as string | null) ?? null,
        }
      : null,
  }
}

export async function upsertInstructorMembership(args: {
  instructorId: number
  tier: InstructorMembershipTier
  stripeCustomerId?: string | null
  stripeCheckoutSessionId?: string | null
  billingCadence: InstructorBillingCadence
  expiresAt: Date
}) {
  await ensureInstructorMembershipSchema()

  const expiresIso = args.expiresAt.toISOString()
  const existing = await sql`
    SELECT id, tier FROM instructor_memberships WHERE instructor_id = ${args.instructorId} LIMIT 1
  `

  const currentTier = normalizeInstructorMembershipTier(existing[0]?.tier) ?? "Free"
  const finalTier = resolveHighestInstructorTier(currentTier, args.tier)

  if (existing.length > 0) {
    await sql`
      UPDATE instructor_memberships
      SET
        tier = ${finalTier},
        plan = ${finalTier},
        status = 'active',
        stripe_customer_id = ${args.stripeCustomerId ?? null},
        stripe_checkout_session_id = ${args.stripeCheckoutSessionId ?? null},
        billing_cadence = ${args.billingCadence},
        expires_at = ${expiresIso}::timestamptz,
        end_date = ${expiresIso}::timestamptz,
        auto_renew = false,
        updated_at = NOW()
      WHERE instructor_id = ${args.instructorId}
    `
  } else {
    await sql`
      INSERT INTO instructor_memberships (
        instructor_id, tier, plan, status, stripe_customer_id, stripe_checkout_session_id,
        billing_cadence, expires_at, end_date, auto_renew, start_date
      )
      VALUES (
        ${args.instructorId},
        ${finalTier},
        ${finalTier},
        'active',
        ${args.stripeCustomerId ?? null},
        ${args.stripeCheckoutSessionId ?? null},
        ${args.billingCadence},
        ${expiresIso}::timestamptz,
        ${expiresIso}::timestamptz,
        false,
        NOW()
      )
    `
  }

  await sql`
    UPDATE instructors
    SET membership_tier = ${finalTier},
        stripe_customer_id = COALESCE(${args.stripeCustomerId ?? null}, stripe_customer_id)
    WHERE id = ${args.instructorId}
  `

  return finalTier
}
