import { type NextRequest, NextResponse } from "next/server"
import { stripe } from "@/lib/stripe"
import { resolveGuestCreditPackCheckout } from "@/lib/guest/mobile-payment"
import { requirePlatformGuestDatabaseId } from "@/lib/require-platform-guest"
import {
  assertMembershipMobilePaymentMethod,
  MEMBERSHIP_SAVEABLE_PAYMENT_METHOD_TYPES,
} from "@/lib/membership-mobile-payment-methods"

export const runtime = "nodejs"

const CORA_PACK_PAYMENT_METHOD_TYPES = new Set(["card", "link"])

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

    const guestId = await requirePlatformGuestDatabaseId(String(body.studentDatabaseId ?? ""))
    const packId = String(body.packId ?? "")
    const paymentMethodId = String(body.paymentMethodId ?? "")
    const shouldSavePaymentMethod = body.shouldSavePaymentMethod === true

    if (guestId == null || !packId || !paymentMethodId) {
      return NextResponse.json(
        { error: "studentDatabaseId, packId, and paymentMethodId are required" },
        { status: 400 },
      )
    }

    const resolved = await resolveGuestCreditPackCheckout(guestId, packId)
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
      type: "guest_cora_credit_pack",
      audience: "guest",
      studentId: String(guestId),
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
    console.error("[guest/cora-credits/mobile-payment-intent] failed:", error)
    return NextResponse.json(
      {
        error: "Failed to create payment intent",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
