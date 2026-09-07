import { type NextRequest, NextResponse } from "next/server"
import {
  createMembershipCustomerSession,
  getStripePublishableKey,
  resolveStudentMembershipCheckout,
} from "@/lib/membership-mobile-payment"

export const runtime = "nodejs"

/** Prepare embedded Payment Element session for student membership checkout. */
export async function POST(request: NextRequest) {
  try {
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

    if (!Number.isFinite(studentId) || !tier) {
      return NextResponse.json({ error: "Student ID and tier required" }, { status: 400 })
    }

    const publishableKey = getStripePublishableKey()
    if (!publishableKey) {
      return NextResponse.json(
        { error: "Payment processing is not configured.", code: "STRIPE_NOT_CONFIGURED" },
        { status: 503 },
      )
    }

    const checkout = await resolveStudentMembershipCheckout(studentId, tier, billingCadence)
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
    console.error("[mobile-payment-sheet] student failed:", error)
    return NextResponse.json(
      { error: "Failed to prepare payment session", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
