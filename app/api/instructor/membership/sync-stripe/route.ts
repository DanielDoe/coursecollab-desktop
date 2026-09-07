import { type NextRequest, NextResponse } from "next/server"
import { ensureInstructorMembershipSchema } from "@/lib/ensure-instructor-membership-schema"
import {
  getInstructorMembershipExpiry,
  upsertInstructorMembership,
} from "@/lib/instructor-membership"
import { normalizeInstructorMembershipTier } from "@/lib/instructor-membership-constants"
import { stripe, STRIPE_INSTRUCTOR_PRODUCTS } from "@/lib/stripe"
import { sql } from "@/lib/db"
import { requireInstructorSession } from "@/lib/instructor-session-auth"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const INSTRUCTOR_PRICE_TO_TIER: Record<string, string> = {
  [STRIPE_INSTRUCTOR_PRODUCTS.Pro_Semester]: "Pro",
  [STRIPE_INSTRUCTOR_PRODUCTS.Pro_Annual]: "Pro",
  [STRIPE_INSTRUCTOR_PRODUCTS.Teams_Semester]: "Teams",
  [STRIPE_INSTRUCTOR_PRODUCTS.Teams_Annual]: "Teams",
  [STRIPE_INSTRUCTOR_PRODUCTS.Enterprise_Semester]: "Teams",
  [STRIPE_INSTRUCTOR_PRODUCTS.Enterprise_Annual]: "Teams",
}

const INSTRUCTOR_PRICE_TO_CADENCE: Record<string, "semester" | "annual"> = {
  [STRIPE_INSTRUCTOR_PRODUCTS.Pro_Semester]: "semester",
  [STRIPE_INSTRUCTOR_PRODUCTS.Pro_Annual]: "annual",
  [STRIPE_INSTRUCTOR_PRODUCTS.Teams_Semester]: "semester",
  [STRIPE_INSTRUCTOR_PRODUCTS.Teams_Annual]: "annual",
  [STRIPE_INSTRUCTOR_PRODUCTS.Enterprise_Semester]: "semester",
  [STRIPE_INSTRUCTOR_PRODUCTS.Enterprise_Annual]: "annual",
}

/** Post-checkout sync when webhook is delayed. */
export async function POST(request: NextRequest) {
  try {
    if (!stripe) {
      return NextResponse.json({ error: "Stripe not configured" }, { status: 503 })
    }

    const body = await request.json()
    const instructorId = parseInt(String(body.instructorId ?? ""), 10)
    const sessionId = body.sessionId as string | undefined

    if (!Number.isFinite(instructorId)) {
      return NextResponse.json({ error: "Instructor ID required" }, { status: 400 })
    }

    const auth = await requireInstructorSession(request)
    if (!auth.ok) return auth.response
    if (auth.instructorId !== instructorId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    await ensureInstructorMembershipSchema()

    const instructorRows = await sql`
      SELECT id, email, stripe_customer_id, membership_tier FROM instructors WHERE id = ${instructorId} LIMIT 1
    `
    if (instructorRows.length === 0) {
      return NextResponse.json({ error: "Instructor not found" }, { status: 404 })
    }

    let customerId = instructorRows[0].stripe_customer_id as string | null
    if (!customerId && instructorRows[0].email) {
      const customers = await stripe.customers.list({
        email: instructorRows[0].email as string,
        limit: 1,
      })
      customerId = customers.data[0]?.id ?? null
      if (customerId) {
        await sql`UPDATE instructors SET stripe_customer_id = ${customerId} WHERE id = ${instructorId}`
      }
    }

    let session = sessionId
      ? await stripe.checkout.sessions.retrieve(sessionId, { expand: ["line_items.data.price"] })
      : null

    if (!session && customerId) {
      const sessions = await stripe.checkout.sessions.list({ customer: customerId, limit: 20 })
      session =
        sessions.data.find(
          (s) =>
            s.payment_status === "paid" &&
            s.metadata?.audience === "instructor" &&
            s.metadata?.instructorId === String(instructorId),
        ) ?? null
    }

    if (!session || session.payment_status !== "paid") {
      return NextResponse.json({
        success: false,
        tier: instructorRows[0].membership_tier,
        message: "No completed instructor checkout found",
      })
    }

    const metaTier = normalizeInstructorMembershipTier(session.metadata?.planId)
    const priceId = session.line_items?.data?.[0]?.price?.id ?? null
    const tierFromPrice = priceId ? INSTRUCTOR_PRICE_TO_TIER[priceId] : null
    const tier = metaTier ?? normalizeInstructorMembershipTier(tierFromPrice) ?? "Free"

    if (tier === "Free") {
      return NextResponse.json({ success: false, tier: "Free", message: "Could not resolve paid tier" })
    }

    const cadence =
      session.metadata?.billingCadence === "annual"
        ? "annual"
        : priceId
          ? INSTRUCTOR_PRICE_TO_CADENCE[priceId] ?? "semester"
          : "semester"

    const expiresAt = await getInstructorMembershipExpiry(cadence)
    const finalTier = await upsertInstructorMembership({
      instructorId,
      tier,
      stripeCustomerId: (session.customer as string | null) ?? customerId,
      stripeCheckoutSessionId: session.id,
      billingCadence: cadence,
      expiresAt,
    })

    return NextResponse.json({ success: true, tier: finalTier, cadence })
  } catch (error) {
    console.error("[instructor/membership/sync-stripe]", error)
    return NextResponse.json({ error: "Sync failed" }, { status: 500 })
  }
}
