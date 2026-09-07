import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { ensureInstructorMembershipSchema } from "@/lib/ensure-instructor-membership-schema"
import { type InstructorMembershipTier } from "@/lib/instructor-membership-constants"
import { stripe, resolveInstructorStripePriceId } from "@/lib/stripe"
import { FACULTY_MEMBERSHIP_HREF } from "@/lib/faculty-portal-nav-config"
import { mobileInstructorMembershipReturnUrls } from "@/lib/mobile-membership-return-urls"

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  try {
    let body: Record<string, unknown>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const { instructorId, tier, billingCadence, redirectCheckout, mobileReturn } = body

    if (!instructorId || !tier) {
      return NextResponse.json({ error: "Instructor ID and tier required" }, { status: 400 })
    }

    const validTiers: InstructorMembershipTier[] = ["Free", "Pro", "Teams"]
    if (!validTiers.includes(tier as InstructorMembershipTier) && String(tier).toLowerCase() !== "enterprise") {
      return NextResponse.json({ error: "Invalid tier" }, { status: 400 })
    }

    const cadence = billingCadence === "annual" ? "annual" : "semester"
    const id = parseInt(String(instructorId), 10)

    await ensureInstructorMembershipSchema()

    if (tier === "Free") {
      await sql`UPDATE instructors SET membership_tier = 'Free' WHERE id = ${id}`
      const existing = await sql`
        SELECT id FROM instructor_memberships WHERE instructor_id = ${id} LIMIT 1
      `
      if (existing.length > 0) {
        await sql`
          UPDATE instructor_memberships
          SET tier = 'Free', plan = 'Free', status = 'active', expires_at = NULL, end_date = NULL,
              billing_cadence = NULL, updated_at = NOW()
          WHERE instructor_id = ${id}
        `
      }
      return NextResponse.json({ success: true, requiresPayment: false, tier: "Free" })
    }

    if (!stripe) {
      return NextResponse.json(
        { error: "Payment processing is not configured", code: "STRIPE_NOT_CONFIGURED" },
        { status: 503 },
      )
    }

    const paidTier = (String(tier).toLowerCase() === "enterprise" ? "Teams" : tier) as "Pro" | "Teams"
    const priceId = resolveInstructorStripePriceId(paidTier, cadence)
    if (!priceId?.startsWith("price_")) {
      return NextResponse.json(
        {
          error: "Invalid tier or billing cadence for payment processing",
          details: `No Stripe price for ${tier} (${cadence})`,
        },
        { status: 400 },
      )
    }

    const instructors = await sql`
      SELECT id, name, email, stripe_customer_id FROM instructors WHERE id = ${id} LIMIT 1
    `
    if (instructors.length === 0) {
      return NextResponse.json({ error: "Instructor not found" }, { status: 404 })
    }

    const instructor = instructors[0]
    if (!instructor.email?.trim()) {
      return NextResponse.json(
        { error: "Please add your email in profile before purchasing", needsEmail: true },
        { status: 400 },
      )
    }

    let customerId: string
    if (instructor.stripe_customer_id) {
      customerId = instructor.stripe_customer_id as string
    } else {
      const existingCustomers = await stripe.customers.list({
        email: instructor.email as string,
        limit: 1,
      })
      if (existingCustomers.data.length > 0) {
        customerId = existingCustomers.data[0].id
      } else {
        const customer = await stripe.customers.create({
          email: instructor.email as string,
          name: (instructor.name as string) || undefined,
          metadata: { instructorId: String(instructor.id), audience: "instructor" },
        })
        customerId = customer.id
      }
      await sql`UPDATE instructors SET stripe_customer_id = ${customerId} WHERE id = ${id}`
    }

    const origin = request.nextUrl.origin
    const useRedirect = redirectCheckout !== false
    const mobileReturns =
      mobileReturn === true ? mobileInstructorMembershipReturnUrls(String(tier), cadence) : null
    const metadata = {
      audience: "instructor",
      instructorId: String(instructor.id),
      planId: paidTier,
      billingCadence: cadence,
    }

    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      ui_mode: useRedirect ? "hosted" : "embedded",
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      ...(useRedirect
        ? {
            success_url:
              mobileReturns?.success_url ??
              `${origin}${FACULTY_MEMBERSHIP_HREF}/success?session_id={CHECKOUT_SESSION_ID}&plan=${tier}`,
            cancel_url:
              mobileReturns?.cancel_url ??
              `${origin}${FACULTY_MEMBERSHIP_HREF}/cancel?plan=${tier}&cadence=${cadence}`,
          }
        : {
            return_url:
              mobileReturns?.success_url ??
              `${origin}${FACULTY_MEMBERSHIP_HREF}/success?session_id={CHECKOUT_SESSION_ID}&plan=${tier}`,
          }),
      metadata,
      payment_intent_data: { metadata },
    })

    if (useRedirect) {
      return NextResponse.json({
        success: true,
        requiresPayment: true,
        redirectUrl: checkoutSession.url,
        sessionId: checkoutSession.id,
      })
    }

    return NextResponse.json({
      success: true,
      requiresPayment: true,
      clientSecret: checkoutSession.client_secret,
      sessionId: checkoutSession.id,
    })
  } catch (error: unknown) {
    console.error("[instructor/membership upgrade]", error)
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: "Failed to start checkout", details: message }, { status: 500 })
  }
}
