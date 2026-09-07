import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { stripe, STRIPE_PRODUCTS } from "@/lib/stripe"
import { getEffectiveMembershipTier } from "@/lib/membership"
import { isExpired } from "@/lib/semester-utils"
import {
  availableBillingCadences,
  isSemesterOnlyBillingStudent,
} from "@/lib/student-billing-eligibility"
import { requireStudentIdParamMatchesCaller } from "@/lib/student-api-auth"

export const dynamic = "force-dynamic"

type PaymentMethodInfo = {
  label: string
  brand?: string | null
  last4?: string | null
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
    console.error("[Membership Details] Stripe payment method lookup failed:", error)
  }

  return null
}


export async function GET(request: NextRequest) {
  try {
    const studentId = request.nextUrl.searchParams.get("studentId")
    if (!studentId) {
      return NextResponse.json({ error: "Student ID required" }, { status: 400 })
    }

    const auth = await requireStudentIdParamMatchesCaller(request, studentId)
    if (!auth.ok) return auth.response
    const parsedId = auth.studentDbId

    const effectiveTier = await getEffectiveMembershipTier(parsedId)

    const studentRows = await sql`
      SELECT
        COALESCE(is_platform_guest, false) AS is_platform_guest,
        stripe_customer_id,
        stripe_subscription_id
      FROM students
      WHERE id = ${parsedId}
      LIMIT 1
    `
    if (studentRows.length === 0) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 })
    }

    const student = studentRows[0]
    const semesterOnlyBilling = isSemesterOnlyBillingStudent(student.is_platform_guest)

    const membershipRows = await sql`
      SELECT
        COALESCE(m.tier, m.plan) AS tier,
        m.status,
        m.billing_cadence,
        m.created_at,
        m.start_date,
        COALESCE(m.expires_at, m.end_date) AS expires_at,
        COALESCE(m.auto_renew, false) AS auto_renew,
        m.stripe_customer_id,
        m.stripe_subscription_id
      FROM memberships m
      WHERE m.student_id = ${parsedId}
      ORDER BY m.created_at DESC
      LIMIT 1
    `

    let subscriptionStatus = membershipRows[0]?.status ?? "active"
    let expiresAt: string | null = membershipRows[0]?.expires_at ?? null
    let purchasedAt: string | null =
      membershipRows[0]?.start_date ?? membershipRows[0]?.created_at ?? null
    let billingCadence: string | null = membershipRows[0]?.billing_cadence ?? null
    let cancelAtPeriodEnd = false
    let autoRenew = Boolean(membershipRows[0]?.auto_renew)
    let stripeCustomerId: string | null =
      membershipRows[0]?.stripe_customer_id ?? student.stripe_customer_id ?? null
    let stripeSubscriptionId: string | null =
      membershipRows[0]?.stripe_subscription_id ?? student.stripe_subscription_id ?? null
    let hasStripeSubscription = Boolean(stripeSubscriptionId)

    if (expiresAt && isExpired(expiresAt) && effectiveTier !== "Scholar") {
      subscriptionStatus = "expired"
    }

    if (stripe && stripeSubscriptionId) {
      try {
        const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId)
        subscriptionStatus = subscription.status
        cancelAtPeriodEnd = subscription.cancel_at_period_end
        expiresAt = new Date(subscription.current_period_end * 1000).toISOString()
        if (!purchasedAt) {
          purchasedAt = new Date(subscription.current_period_start * 1000).toISOString()
        }
        const priceId = subscription.items.data[0]?.price.id
        if (!billingCadence && priceId) {
          if (
            priceId === STRIPE_PRODUCTS.Explorer_Semester ||
            priceId === STRIPE_PRODUCTS.Trailblazer_Semester
          ) {
            billingCadence = "semester"
          } else {
            billingCadence = "monthly"
          }
        }
      } catch (error) {
        console.error("[Membership Details] Stripe subscription lookup failed:", error)
      }
    }

    let paymentMethod = await resolveStripePaymentMethod(stripeCustomerId)

    // donations records no payment method, so it can only date the purchase.
    if (!purchasedAt) {
      try {
        const donationRows = await sql`
          SELECT created_at
          FROM donations
          WHERE student_id = ${parsedId}
            AND status = 'completed'
            AND deleted_at IS NULL
          ORDER BY created_at DESC
          LIMIT 1
        `
        if (donationRows.length > 0 && donationRows[0].created_at) {
          purchasedAt = donationRows[0].created_at
        }
      } catch {
        /* donations table may differ */
      }
    }

    const isFreeTier = effectiveTier === "Scholar"
    const isActive =
      !isFreeTier &&
      subscriptionStatus !== "expired" &&
      subscriptionStatus !== "cancelled" &&
      subscriptionStatus !== "canceled" &&
      (!expiresAt || !isExpired(expiresAt))

    let institutionalAccess = null
    let effectiveFeatureTier = effectiveTier
    try {
      const { getEffectiveStudentAccess } = await import("@/lib/entitlements/resolver")
      const { INSTITUTION_SPONSORED_STUDENT_TIER } = await import("@/lib/entitlements/feature-bundles")
      const access = await getEffectiveStudentAccess(parsedId)
      if (access.institutionalEntitlement === "institution_student_access") {
        effectiveFeatureTier = INSTITUTION_SPONSORED_STUDENT_TIER
        institutionalAccess = {
          active: true,
          providedBy: access.providedBy,
          expiresAt: access.expiresAt,
          source: access.source,
          personalTier: access.personalTier,
          sponsoredFeatureTier: INSTITUTION_SPONSORED_STUDENT_TIER,
        }
      }
    } catch {
      /* optional */
    }

    return NextResponse.json({
      currentTier: effectiveTier,
      effectiveFeatureTier,
      subscription: {
        tier: effectiveTier,
        status: subscriptionStatus,
        isActive,
        purchasedAt,
        validThrough: expiresAt,
        billingCadence: billingCadence ?? (semesterOnlyBilling ? "semester" : null),
        cancelAtPeriodEnd,
        autoRenew,
        paymentMethod,
        isFreeTier,
        hasStripeSubscription,
      },
      billing: {
        semesterOnly: semesterOnlyBilling,
        availableCadences: availableBillingCadences(semesterOnlyBilling),
      },
      institutionalAccess,
    })
  } catch (error) {
    console.error("[Membership Details] Failed:", error)
    return NextResponse.json({ error: "Failed to fetch membership details" }, { status: 500 })
  }
}
