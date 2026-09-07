import { type NextRequest, NextResponse } from "next/server"
import { ensureInstructorMembershipSchema } from "@/lib/ensure-instructor-membership-schema"
import { getInstructorMembership } from "@/lib/instructor-membership"
import {
  INSTRUCTOR_MEMBERSHIP_PLANS,
  type InstructorMembershipTier,
} from "@/lib/instructor-membership-constants"
import { stripe, STRIPE_INSTRUCTOR_PRODUCTS } from "@/lib/stripe"
import { isExpired } from "@/lib/semester-utils"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type PaymentMethodInfo = {
  label: string
  brand?: string | null
  last4?: string | null
}

function formatStoredPaymentMethod(raw: string | null | undefined): PaymentMethodInfo | null {
  if (!raw) return null
  switch (raw) {
    case "apple_pay":
      return { label: "Apple Pay" }
    case "google_pay":
      return { label: "Google Pay" }
    case "stripe_card":
      return { label: "Card" }
    default:
      return { label: raw.replace(/_/g, " ") }
  }
}

async function resolveStripePaymentMethod(
  customerId: string | null | undefined,
): Promise<PaymentMethodInfo | null> {
  if (!stripe || !customerId) return null

  try {
    const customer = await stripe.customers.retrieve(customerId, {
      expand: ["invoice_settings.default_payment_method"],
    })
    if (customer.deleted) return null

    const defaultPm = customer.invoice_settings?.default_payment_method
    if (defaultPm && typeof defaultPm !== "string") {
      if (defaultPm.type === "card" && defaultPm.card) {
        const wallet = defaultPm.card.wallet?.type
        if (wallet === "apple_pay") return { label: "Apple Pay", brand: "apple_pay" }
        if (wallet === "google_pay") return { label: "Google Pay", brand: "google_pay" }
        const brand = defaultPm.card.brand ?? "card"
        const last4 = defaultPm.card.last4 ?? undefined
        return {
          label: `${brand.charAt(0).toUpperCase()}${brand.slice(1)} •••• ${last4 ?? "····"}`,
          brand,
          last4: last4 ?? null,
        }
      }
    }

    const methods = await stripe.paymentMethods.list({
      customer: customerId,
      type: "card",
      limit: 1,
    })
    const pm = methods.data[0]
    if (pm?.card) {
      const wallet = pm.card.wallet?.type
      if (wallet === "apple_pay") return { label: "Apple Pay", brand: "apple_pay" }
      if (wallet === "google_pay") return { label: "Google Pay", brand: "google_pay" }
      const brand = pm.card.brand ?? "card"
      return {
        label: `${brand.charAt(0).toUpperCase()}${brand.slice(1)} •••• ${pm.card.last4 ?? "····"}`,
        brand,
        last4: pm.card.last4 ?? null,
      }
    }
  } catch (error) {
    console.error("[Instructor Membership Details] Stripe payment method lookup failed:", error)
  }

  return null
}

export async function GET(request: NextRequest) {
  try {
    const instructorIdParam = request.nextUrl.searchParams.get("instructorId")
    if (!instructorIdParam) {
      return NextResponse.json({ error: "Instructor ID required" }, { status: 400 })
    }

    const instructorId = parseInt(instructorIdParam, 10)
    if (!Number.isFinite(instructorId)) {
      return NextResponse.json({ error: "Invalid instructor ID" }, { status: 400 })
    }

    await ensureInstructorMembershipSchema()
    const membership = await getInstructorMembership(instructorId)
    if (!membership) {
      return NextResponse.json({ error: "Instructor not found" }, { status: 404 })
    }

    const currentTier = membership.tier
    const plan = INSTRUCTOR_MEMBERSHIP_PLANS.find((p) => p.id === currentTier) ?? null

    let subscriptionStatus = membership.membership?.status ?? "active"
    const expiresAt: string | null = membership.membership?.expiresAt?.toISOString() ?? null
    const purchasedAt: string | null = membership.membership?.startDate?.toISOString() ?? null
    let billingCadence = membership.membership?.billingCadence ?? null
    const cancelAtPeriodEnd = false
    const autoRenew = Boolean(membership.membership?.autoRenew)
    const stripeCustomerId = membership.stripeCustomerId
    const hasStripeSubscription = Boolean(stripeCustomerId)

    if (expiresAt && isExpired(expiresAt) && currentTier !== "Free") {
      subscriptionStatus = "expired"
    }

    if (!billingCadence && currentTier !== "Free") {
      billingCadence = "semester"
    }

    let paymentMethod = await resolveStripePaymentMethod(stripeCustomerId)
    if (!paymentMethod && membership.membership?.stripeCheckoutSessionId && stripe) {
      try {
        const session = await stripe.checkout.sessions.retrieve(
          membership.membership.stripeCheckoutSessionId,
        )
        if (session.payment_method_types?.includes("card")) {
          paymentMethod = formatStoredPaymentMethod("stripe_card")
        }
      } catch {
        /* optional checkout metadata */
      }
    }

    const isFreeTier = currentTier === "Free"
    const isActive =
      !isFreeTier &&
      subscriptionStatus !== "expired" &&
      subscriptionStatus !== "cancelled" &&
      subscriptionStatus !== "canceled" &&
      (!expiresAt || !isExpired(expiresAt))

    let institutionalAccess = null
    let effectiveFeatureTier: InstructorMembershipTier = currentTier
    try {
      const { getEffectiveInstructorAccess } = await import("@/lib/entitlements/resolver")
      const { INSTITUTION_SPONSORED_INSTRUCTOR_TIER } = await import("@/lib/entitlements/feature-bundles")
      const access = await getEffectiveInstructorAccess(membership.instructorId)
      if (access.institutionalEntitlement === "institution_instructor_access") {
        effectiveFeatureTier = INSTITUTION_SPONSORED_INSTRUCTOR_TIER
        institutionalAccess = {
          active: true,
          providedBy: access.providedBy,
          expiresAt: access.expiresAt,
          source: access.source,
          personalTier: access.personalTier,
          sponsoredFeatureTier: INSTITUTION_SPONSORED_INSTRUCTOR_TIER,
        }
      }
    } catch {
      /* optional */
    }

    const effectivePlan =
      INSTRUCTOR_MEMBERSHIP_PLANS.find((p) => p.id === effectiveFeatureTier) ?? plan

    return NextResponse.json({
      currentTier,
      effectiveFeatureTier,
      membership: {
        tier: currentTier,
        plan: membership.membership?.plan ?? currentTier,
        status: subscriptionStatus,
        billingCadence,
        expiresAt,
        stripeCustomerId,
      },
      plan: effectivePlan,
      subscription: {
        tier: currentTier,
        status: subscriptionStatus,
        isActive,
        purchasedAt,
        validThrough: expiresAt,
        billingCadence,
        cancelAtPeriodEnd,
        autoRenew,
        paymentMethod,
        isFreeTier,
        hasStripeSubscription,
      },
      billing: {
        semesterOnly: false,
        availableCadences: ["semester", "annual"] as const,
        defaultCadence: "semester" as const,
        stripePriceIds: {
          Pro: {
            semester: STRIPE_INSTRUCTOR_PRODUCTS.Pro_Semester ?? null,
            annual: STRIPE_INSTRUCTOR_PRODUCTS.Pro_Annual ?? null,
          },
          Teams: {
            semester: STRIPE_INSTRUCTOR_PRODUCTS.Teams_Semester ?? null,
            annual: STRIPE_INSTRUCTOR_PRODUCTS.Teams_Annual ?? null,
          },
        } satisfies Record<
          Exclude<InstructorMembershipTier, "Free">,
          { semester: string | null; annual: string | null }
        >,
      },
      institutionalAccess,
    })
  } catch (error) {
    console.error("[Instructor Membership Details] Failed:", error)
    return NextResponse.json({ error: "Failed to fetch membership details" }, { status: 500 })
  }
}
