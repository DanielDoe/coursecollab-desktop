import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { stripe } from "@/lib/stripe"
import { requirePlatformGuestDatabaseId } from "@/lib/require-platform-guest"
import {
  getGuestAccessPlan,
  isGuestCareerPaidPlan,
  resolveGuestLifetimeStripePriceId,
  type GuestCareerPaidPlanId,
} from "@/lib/guest/membership-config"
import { getGuestFeatureFlags } from "@/lib/guest/feature-flags"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  try {
    const flags = getGuestFeatureFlags()
    if (!flags.guestMembershipEnabled || !flags.coraCareerEnabled) {
      return NextResponse.json({ error: "Cora Career checkout is not available yet." }, { status: 503 })
    }
    if (!stripe) {
      return NextResponse.json({ error: "Payment processing is not configured", code: "STRIPE_NOT_CONFIGURED" }, { status: 503 })
    }

    const body = await request.json()
    const guestId = await requirePlatformGuestDatabaseId(String(body.studentDatabaseId ?? "").trim())
    if (guestId == null) return NextResponse.json({ error: "Career Member not found" }, { status: 404 })

    const rawPlan = String(body.plan ?? body.planId ?? "cora_career").trim()
    const plan: GuestCareerPaidPlanId = isGuestCareerPaidPlan(rawPlan) ? rawPlan : "cora_career"
    const cfg = getGuestAccessPlan(plan)

    const students = (await sql`
      SELECT id, email, full_name, stripe_customer_id FROM students WHERE id = ${guestId} LIMIT 1
    `) as Array<{ id: number; email: string | null; full_name: string | null; stripe_customer_id: string | null }>
    const student = students[0]
    if (!student?.email?.trim() || student.email.includes("@student.placeholder.edu")) {
      return NextResponse.json({ error: "Please add your email in Profile before purchasing.", needsEmail: true }, { status: 400 })
    }

    let customerId = student.stripe_customer_id
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: student.email,
        name: student.full_name ?? undefined,
        metadata: { studentId: String(student.id), audience: "guest" },
      })
      customerId = customer.id
      await sql`UPDATE students SET stripe_customer_id = ${customerId} WHERE id = ${student.id}`
    }

    const origin = request.nextUrl.origin
    const priceId = resolveGuestLifetimeStripePriceId(plan)
    const metadataType =
      plan === "cora_career_essentials" ? "guest_career_essentials" : "guest_career_lifetime"
    const metadata = {
      type: metadataType,
      audience: "guest",
      plan,
      studentId: String(student.id),
      credits: String(cfg.coraCreditsIncluded),
    }

    const lineItems = priceId
      ? [{ price: priceId, quantity: 1 }]
      : [{
          price_data: {
            currency: "usd",
            unit_amount: cfg.priceCents,
            product_data: {
              name: cfg.displayName,
              description: `One-time unlock + ${cfg.coraCreditsIncluded.toLocaleString()} Cora Credits. No subscription.`,
            },
          },
          quantity: 1,
        }]

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer: customerId,
      line_items: lineItems,
      success_url: `${origin}/guest/cora-career/access?success=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/guest/cora-career/access?cancelled=1`,
      metadata,
      payment_intent_data: { metadata },
    })

    return NextResponse.json({ url: session.url, sessionId: session.id, plan })
  } catch (e) {
    console.error("[guest/cora-career/checkout]", e)
    return NextResponse.json({ error: "Checkout failed" }, { status: 500 })
  }
}
