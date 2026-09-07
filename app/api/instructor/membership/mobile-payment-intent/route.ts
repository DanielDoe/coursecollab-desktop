import { type NextRequest, NextResponse } from "next/server"
import { stripe } from "@/lib/stripe"
import { resolveInstructorMembershipCheckout } from "@/lib/membership-mobile-payment"
import {
  assertMembershipMobilePaymentMethod,
  MEMBERSHIP_SAVEABLE_PAYMENT_METHOD_TYPES,
} from "@/lib/membership-mobile-payment-methods"
import { ensureInstructorMembershipSchema } from "@/lib/ensure-instructor-membership-schema"

export const runtime = "nodejs"

/** Create PaymentIntent from Embedded Payment Element confirmation token (faculty). */
export async function POST(request: NextRequest) {
  try {
    await ensureInstructorMembershipSchema()

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

    const instructorId = parseInt(String(body.instructorId ?? ""), 10)
    const tier = String(body.tier ?? "")
    const billingCadence = body.billingCadence === "annual" ? "annual" : ("semester" as const)
    const paymentMethodId = String(body.paymentMethodId ?? "")
    const shouldSavePaymentMethod = body.shouldSavePaymentMethod === true

    if (!Number.isFinite(instructorId) || !tier || !paymentMethodId) {
      return NextResponse.json(
        { error: "instructorId, tier, and paymentMethodId are required" },
        { status: 400 },
      )
    }

    const checkout = await resolveInstructorMembershipCheckout(instructorId, tier, billingCadence)
    if (!checkout.ok) {
      return NextResponse.json(
        { error: checkout.error, needsEmail: checkout.needsEmail },
        { status: checkout.status },
      )
    }

    const pmCheck = await assertMembershipMobilePaymentMethod(
      paymentMethodId,
      checkout.amountCents,
    )
    if (!pmCheck.ok) {
      return NextResponse.json({ error: pmCheck.error }, { status: 400 })
    }

    const canSave =
      shouldSavePaymentMethod && MEMBERSHIP_SAVEABLE_PAYMENT_METHOD_TYPES.has(pmCheck.type)

    const paymentIntent = await stripe.paymentIntents.create({
      amount: checkout.amountCents,
      currency: checkout.currency,
      customer: checkout.customerId,
      payment_method: paymentMethodId,
      // Only the selected method — avoid Affirm/amount conflicts on multi-type lists.
      payment_method_types: [pmCheck.type],
      setup_future_usage: canSave ? "off_session" : undefined,
      metadata: {
        audience: "instructor",
        instructorId: String(instructorId),
        planId: tier,
        billingCadence: checkout.cadence,
        priceId: checkout.priceId,
        source: "mobile_payment_element",
        paymentMethodType: pmCheck.type,
        shouldSavePaymentMethod: shouldSavePaymentMethod ? "true" : "false",
      },
    })

    if (!paymentIntent.client_secret) {
      return NextResponse.json({ error: "PaymentIntent client secret missing" }, { status: 500 })
    }

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    })
  } catch (error: unknown) {
    console.error("[mobile-payment-intent] instructor failed:", error)
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: "Failed to create payment intent", details: message },
      { status: 500 },
    )
  }
}
