import { type NextRequest, NextResponse } from "next/server"
import { stripe } from "@/lib/stripe"
import { resolveInstructorCoraPackCheckout } from "@/lib/cora/credits/mobile-payment"
import {
  assertMembershipMobilePaymentMethod,
  MEMBERSHIP_SAVEABLE_PAYMENT_METHOD_TYPES,
} from "@/lib/membership-mobile-payment-methods"

export const runtime = "nodejs"

const CORA_PACK_PAYMENT_METHOD_TYPES = new Set(["card", "link"])

/** Create PaymentIntent after PaymentSheet confirms an instructor Cora Credit Pack. */
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

    const instructorId = parseInt(String(body.instructorId ?? ""), 10)
    const packId = String(body.packId ?? "")
    const paymentMethodId = String(body.paymentMethodId ?? "")
    const shouldSavePaymentMethod = body.shouldSavePaymentMethod === true

    if (!Number.isFinite(instructorId) || !packId || !paymentMethodId) {
      return NextResponse.json(
        { error: "instructorId, packId, and paymentMethodId are required" },
        { status: 400 },
      )
    }

    const resolved = await resolveInstructorCoraPackCheckout(instructorId, packId)
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
    if (!CORA_PACK_PAYMENT_METHOD_TYPES.has(pmCheck.type)) {
      return NextResponse.json(
        { error: "Use a card or Link for Cora Credit Packs." },
        { status: 400 },
      )
    }

    const canSave =
      shouldSavePaymentMethod && MEMBERSHIP_SAVEABLE_PAYMENT_METHOD_TYPES.has(pmCheck.type)

    const metadata = {
      type: "cora_credit_pack",
      audience: "instructor",
      instructorId: String(instructorId),
      packId: resolved.checkout.pack.id,
      credits: String(resolved.checkout.pack.credits),
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
    console.error("[cora-credits/mobile-payment-intent] instructor failed:", error)
    return NextResponse.json(
      {
        error: "Failed to create payment intent",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
