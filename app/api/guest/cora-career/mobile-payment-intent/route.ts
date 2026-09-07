import { type NextRequest, NextResponse } from "next/server"
import { stripe } from "@/lib/stripe"
import { resolveGuestCareerCheckout } from "@/lib/guest/mobile-payment"
import { requirePlatformGuestDatabaseId } from "@/lib/require-platform-guest"
import { getGuestFeatureFlags } from "@/lib/guest/feature-flags"
import {
  assertMembershipMobilePaymentMethod,
  MEMBERSHIP_SAVEABLE_PAYMENT_METHOD_TYPES,
  membershipPaymentMethodTypesForAmount,
} from "@/lib/membership-mobile-payment-methods"

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  try {
    const flags = getGuestFeatureFlags()
    if (!flags.guestMembershipEnabled || !flags.coraCareerEnabled) {
      return NextResponse.json({ error: "Cora Career checkout is not available yet." }, { status: 503 })
    }
    if (!stripe) {
      return NextResponse.json(
        { error: "Payment processing is not configured.", code: "STRIPE_NOT_CONFIGURED" },
        { status: 503 },
      )
    }

    let body: Record<string, unknown>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const guestId = await requirePlatformGuestDatabaseId(String(body.studentDatabaseId ?? ""))
    const paymentMethodId = String(body.paymentMethodId ?? "")
    const shouldSavePaymentMethod = body.shouldSavePaymentMethod === true

    if (guestId == null || !paymentMethodId) {
      return NextResponse.json(
        { error: "studentDatabaseId and paymentMethodId are required" },
        { status: 400 },
      )
    }

    const resolved = await resolveGuestCareerCheckout(guestId)
    if (!resolved.ok) {
      return NextResponse.json(
        { error: resolved.error, needsEmail: resolved.needsEmail },
        { status: resolved.status },
      )
    }

    const pmCheck = await assertMembershipMobilePaymentMethod(
      paymentMethodId,
      resolved.checkout.amountCents,
    )
    if (!pmCheck.ok) {
      return NextResponse.json({ error: pmCheck.error }, { status: 400 })
    }

    const allowed = new Set(membershipPaymentMethodTypesForAmount(resolved.checkout.amountCents))
    if (!allowed.has(pmCheck.type)) {
      return NextResponse.json({ error: "Payment method not supported for this purchase." }, { status: 400 })
    }

    const canSave =
      shouldSavePaymentMethod && MEMBERSHIP_SAVEABLE_PAYMENT_METHOD_TYPES.has(pmCheck.type)

    const metadata = {
      type: "guest_career_lifetime",
      audience: "guest",
      plan: "cora_career",
      studentId: String(guestId),
      credits: String(resolved.checkout.creditsIncluded),
      source: "mobile_payment_element",
      paymentMethodType: pmCheck.type,
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: resolved.checkout.amountCents,
      currency: resolved.checkout.currency,
      customer: resolved.checkout.customerId,
      payment_method: paymentMethodId,
      payment_method_types: [pmCheck.type],
      setup_future_usage: canSave ? "off_session" : undefined,
      metadata,
    })

    if (!paymentIntent.client_secret) {
      return NextResponse.json({ error: "PaymentIntent client secret missing" }, { status: 500 })
    }

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    })
  } catch (error: unknown) {
    console.error("[guest/cora-career/mobile-payment-intent] failed:", error)
    return NextResponse.json(
      {
        error: "Failed to create payment intent",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
