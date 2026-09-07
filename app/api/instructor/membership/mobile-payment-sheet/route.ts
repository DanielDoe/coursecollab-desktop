import { type NextRequest, NextResponse } from "next/server"
import {
  createMembershipCustomerSession,
  getStripePublishableKey,
  resolveInstructorMembershipCheckout,
} from "@/lib/membership-mobile-payment"
import { ensureInstructorMembershipSchema } from "@/lib/ensure-instructor-membership-schema"

export const runtime = "nodejs"

/** Prepare embedded Payment Element session for faculty membership checkout. */
export async function POST(request: NextRequest) {
  try {
    await ensureInstructorMembershipSchema()

    let body: Record<string, unknown>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const instructorId = parseInt(String(body.instructorId ?? ""), 10)
    const tier = String(body.tier ?? "")
    const billingCadence = body.billingCadence === "annual" ? "annual" : ("semester" as const)

    if (!Number.isFinite(instructorId) || !tier) {
      return NextResponse.json({ error: "Instructor ID and tier required" }, { status: 400 })
    }

    const publishableKey = getStripePublishableKey()
    if (!publishableKey) {
      return NextResponse.json(
        { error: "Payment processing is not configured.", code: "STRIPE_NOT_CONFIGURED" },
        { status: 503 },
      )
    }

    const checkout = await resolveInstructorMembershipCheckout(instructorId, tier, billingCadence)
    if (!checkout.ok) {
      return NextResponse.json(
        { error: checkout.error, needsEmail: checkout.needsEmail },
        { status: checkout.status },
      )
    }

    const customerSessionClientSecret = await createMembershipCustomerSession(checkout.customerId)

    return NextResponse.json({
      publishableKey,
      customerId: checkout.customerId,
      customerSessionClientSecret,
      amountCents: checkout.amountCents,
      currency: checkout.currency,
      tier,
      billingCadence: checkout.cadence,
      merchantDisplayName: "CourseCollab",
      merchantCountryCode: "US",
    })
  } catch (error: unknown) {
    console.error("[mobile-payment-sheet] instructor failed:", error)
    return NextResponse.json(
      { error: "Failed to prepare payment session", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
