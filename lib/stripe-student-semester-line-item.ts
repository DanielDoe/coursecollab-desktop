import type Stripe from "stripe"
import { getStudentMembershipPlan, type MembershipTier } from "@/lib/membership-constants"
import { stripe, STRIPE_PRODUCTS } from "@/lib/stripe"

/**
 * New semester purchases always charge the current catalog amount.
 * Existing Stripe price IDs are reused only when their unit_amount already matches.
 * Otherwise we send price_data so we do not silently charge retired $24.99 / $39.99 prices.
 */
export async function studentSemesterLineItem(
  tier: "Explorer" | "Trailblazer",
): Promise<Stripe.Checkout.SessionCreateParams.LineItem> {
  const plan = getStudentMembershipPlan(tier)
  const catalogCents = plan.semesterPriceInCents ?? 0
  const configuredId =
    tier === "Explorer" ? STRIPE_PRODUCTS.Explorer_Semester : STRIPE_PRODUCTS.Trailblazer_Semester

  if (stripe && configuredId.startsWith("price_")) {
    try {
      const price = await stripe.prices.retrieve(configuredId)
      if (price.unit_amount === catalogCents && price.active !== false) {
        return { price: configuredId, quantity: 1 }
      }
    } catch {
      /* fall through to catalog price_data */
    }
  }

  return {
    quantity: 1,
    price_data: {
      currency: "usd",
      unit_amount: catalogCents,
      product_data: {
        name: `${plan.displayName} Semester`,
        description: `${plan.subtitle} — student discount, one-time this semester (save $10)`,
        metadata: {
          plan_id: tier,
          billing_cadence: "semester",
          catalog_cents: String(catalogCents),
        },
      },
    },
  }
}

export function catalogSemesterFallbackUsd(tier: MembershipTier, isSemester: boolean): number {
  if (!isSemester) {
    const plan = getStudentMembershipPlan(tier)
    return (plan.monthlyPriceInCents ?? plan.priceInCents) / 100
  }
  if (tier === "Explorer" || tier === "Trailblazer") {
    return (getStudentMembershipPlan(tier).semesterPriceInCents ?? 0) / 100
  }
  return 0
}
