import { type NextRequest, NextResponse } from "next/server"
import { stripe } from "@/lib/stripe"
import { resolveStudentMembershipCheckout } from "@/lib/membership-mobile-payment"
import {
  assertMembershipMobilePaymentMethod,
  MEMBERSHIP_SAVEABLE_PAYMENT_METHOD_TYPES,
} from "@/lib/membership-mobile-payment-methods"

export const runtime = "nodejs"

/** Create PaymentIntent from Embedded Payment Element confirmation token. */
export async function POST(request: NextRequest) {
  try {
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

    const studentId = parseInt(String(body.studentId ?? ""), 10)
    const tier = String(body.tier ?? "")
    const billingCadence =
      body.billingCadence === "monthly" ? "monthly" : ("semester" as const)
    const paymentMethodId = String(body.paymentMethodId ?? "")
    const shouldSavePaymentMethod = body.shouldSavePaymentMethod === true

    if (!Number.isFinite(studentId) || !tier || !paymentMethodId) {
      return NextResponse.json(
        { error: "studentId, tier, and paymentMethodId are required" },
        { status: 400 },
      )
    }

    const checkout = await resolveStudentMembershipCheckout(studentId, tier, billingCadence)
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
      // Only the selected method — listing Affirm/others with incompatible amounts
      // makes Stripe reject the entire PaymentIntent create.
      payment_method_types: [pmCheck.type],
      setup_future_usage: canSave ? "off_session" : undefined,
      metadata: {
        studentId: String(studentId),
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
    console.error("[mobile-payment-intent] student failed:", error)
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: "Failed to create payment intent", details: message },
      { status: 500 },
    )
  }
}
