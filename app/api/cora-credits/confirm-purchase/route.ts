import { type NextRequest, NextResponse } from "next/server"
import { stripe } from "@/lib/stripe"
import { fulfillCoraCreditPackPurchase } from "@/lib/cora/credits/fulfill-purchase"
import { requireBuyerMatchesPaymentCaller } from "@/lib/stripe-payment-guards"
import { checkRateLimit, PAYMENT_MUTATION_RATE_LIMIT, rateLimitKey } from "@/lib/compliance/rate-limit"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/** Client-side success fallback if webhook is delayed (Checkout Session or PaymentIntent). */
export async function POST(request: NextRequest) {
  try {
    const limited = checkRateLimit(
      rateLimitKey(request, "confirm-purchase"),
      PAYMENT_MUTATION_RATE_LIMIT.limit,
      PAYMENT_MUTATION_RATE_LIMIT.windowMs,
    )
    if (!limited.ok) {
      return NextResponse.json({ error: "Too many payment requests" }, { status: 429 })
    }
    if (!stripe) {
      return NextResponse.json({ error: "Stripe not configured" }, { status: 503 })
    }
    const body = await request.json()
    const sessionId = String(body.sessionId ?? "")
    const paymentIntentId = String(body.paymentIntentId ?? "")

    if (paymentIntentId.startsWith("pi_")) {
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)
      if (paymentIntent.status !== "succeeded") {
        return NextResponse.json(
          { error: "Payment not complete", status: paymentIntent.status },
          { status: 402 },
        )
      }

      if (paymentIntent.metadata?.type === "guest_cora_credit_pack") {
        const studentId = parseInt(String(paymentIntent.metadata.studentId ?? ""), 10)
        const packId = String(paymentIntent.metadata.packId ?? "").trim()
        if (!Number.isFinite(studentId) || !packId) {
          return NextResponse.json({ error: "Missing guest or pack" }, { status: 400 })
        }
        const buyer = await requireBuyerMatchesPaymentCaller(request, "student", studentId)
        if (!buyer.ok) return buyer.response
        const { fulfillGuestCreditPackPurchase } = await import("@/lib/guest/fulfill-membership")
        const result = await fulfillGuestCreditPackPurchase({
          stripeSessionId: paymentIntent.id,
          studentId,
          packId,
          amountCents: paymentIntent.amount_received || paymentIntent.amount,
          currency: paymentIntent.currency ?? "usd",
        })
        return NextResponse.json({ success: result.ok, ...result })
      }

      if (paymentIntent.metadata?.type === "guest_career_lifetime") {
        const studentId = parseInt(String(paymentIntent.metadata.studentId ?? ""), 10)
        if (!Number.isFinite(studentId)) {
          return NextResponse.json({ error: "Missing guest" }, { status: 400 })
        }
        const buyer = await requireBuyerMatchesPaymentCaller(request, "student", studentId)
        if (!buyer.ok) return buyer.response
        const { fulfillGuestCoraCareerLifetime } = await import("@/lib/guest/fulfill-membership")
        const result = await fulfillGuestCoraCareerLifetime({
          stripeSessionId: paymentIntent.id,
          studentId,
          amountCents: paymentIntent.amount_received || paymentIntent.amount,
          currency: paymentIntent.currency ?? "usd",
        })
        return NextResponse.json({ success: result.ok, ...result })
      }

      if (paymentIntent.metadata?.type !== "cora_credit_pack") {
        return NextResponse.json({ error: "Not a Cora Credit Pack payment" }, { status: 400 })
      }

      const audience =
        paymentIntent.metadata.audience === "instructor" ? "instructor" : "student"
      const packId = paymentIntent.metadata.packId || ""
      const buyerId = parseInt(
        String(
          audience === "instructor"
            ? paymentIntent.metadata.instructorId
            : paymentIntent.metadata.studentId,
        ),
        10,
      )
      if (!Number.isFinite(buyerId) || !packId) {
        return NextResponse.json({ error: "Missing buyer or pack" }, { status: 400 })
      }

      const buyer = await requireBuyerMatchesPaymentCaller(request, audience, buyerId)
      if (!buyer.ok) return buyer.response

      let studentTier: "Scholar" | "Explorer" | "Trailblazer" | undefined
      if (audience === "student") {
        const { getEffectiveMembershipTier } = await import("@/lib/membership")
        const tier = await getEffectiveMembershipTier(buyerId)
        if (tier === "Explorer" || tier === "Trailblazer" || tier === "Scholar") studentTier = tier
      }

      const result = await fulfillCoraCreditPackPurchase({
        stripeSessionId: paymentIntent.id,
        audience,
        buyerId,
        packId,
        amountCents: paymentIntent.amount_received || paymentIntent.amount,
        studentTier,
      })
      return NextResponse.json({ success: result.ok, ...result })
    }

    if (!sessionId.startsWith("cs_")) {
      return NextResponse.json({ error: "Invalid session" }, { status: 400 })
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId)
    if (session.payment_status !== "paid") {
      return NextResponse.json({ error: "Payment not complete", status: session.payment_status }, { status: 402 })
    }
    if (session.metadata?.type !== "cora_credit_pack") {
      return NextResponse.json({ error: "Not a Cora Credit Pack session" }, { status: 400 })
    }

    const audience = session.metadata.audience === "instructor" ? "instructor" : "student"
    const packId = session.metadata.packId || ""
    const buyerId = parseInt(
      String(audience === "instructor" ? session.metadata.instructorId : session.metadata.studentId),
      10,
    )
    if (!Number.isFinite(buyerId) || !packId) {
      return NextResponse.json({ error: "Missing buyer or pack" }, { status: 400 })
    }

    const buyer = await requireBuyerMatchesPaymentCaller(request, audience, buyerId)
    if (!buyer.ok) return buyer.response

    let studentTier: "Scholar" | "Explorer" | "Trailblazer" | undefined
    if (audience === "student") {
      const { getEffectiveMembershipTier } = await import("@/lib/membership")
      const tier = await getEffectiveMembershipTier(buyerId)
      if (tier === "Explorer" || tier === "Trailblazer" || tier === "Scholar") studentTier = tier
    }

    const result = await fulfillCoraCreditPackPurchase({
      stripeSessionId: session.id,
      audience,
      buyerId,
      packId,
      amountCents: session.amount_total ?? undefined,
      studentTier,
    })

    return NextResponse.json({ success: result.ok, ...result })
  } catch (error) {
    console.error("[cora-credits/confirm-purchase]", error)
    return NextResponse.json({ error: "Confirm failed" }, { status: 500 })
  }
}
