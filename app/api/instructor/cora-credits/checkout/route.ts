import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { stripe } from "@/lib/stripe"
import { getCoraPack } from "@/lib/cora/credits/packs"
import { packLineItem } from "@/lib/cora/credits/fulfill-purchase"
import { FACULTY_MEMBERSHIP_HREF } from "@/lib/faculty-portal-nav-config"
import { mobileInstructorCoraPackReturnUrls } from "@/lib/mobile-membership-return-urls"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  try {
    if (!stripe) {
      return NextResponse.json(
        { error: "Payment processing is not configured", code: "STRIPE_NOT_CONFIGURED" },
        { status: 503 },
      )
    }

    const body = await request.json()
    const instructorId = parseInt(String(body.instructorId ?? ""), 10)
    const packId = String(body.packId ?? "")
    const mobile = body.mobile === true || body.platform === "mobile"
    const pack = getCoraPack(packId)

    if (!Number.isFinite(instructorId) || instructorId <= 0) {
      return NextResponse.json({ error: "Instructor ID required" }, { status: 400 })
    }
    if (!pack || pack.audience !== "instructor") {
      return NextResponse.json({ error: "Invalid Cora Credit Pack" }, { status: 400 })
    }

    const instructors = (await sql`
      SELECT id, email, name, stripe_customer_id FROM instructors WHERE id = ${instructorId} LIMIT 1
    `) as Array<{
      id: number
      email: string | null
      name: string | null
      stripe_customer_id: string | null
    }>

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

    let customerId = instructor.stripe_customer_id
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: instructor.email,
        name: instructor.name ?? undefined,
        metadata: { instructorId: String(instructor.id), audience: "instructor" },
      })
      customerId = customer.id
      await sql`UPDATE instructors SET stripe_customer_id = ${customerId} WHERE id = ${instructor.id}`
    }

    const origin = request.nextUrl.origin
    const metadata = {
      type: "cora_credit_pack",
      audience: "instructor",
      instructorId: String(instructor.id),
      packId: pack.id,
      credits: String(pack.credits),
    }

    const returnUrls = mobile
      ? mobileInstructorCoraPackReturnUrls()
      : {
          success_url: `${origin}${FACULTY_MEMBERSHIP_HREF}?cora_pack=success&pack=${pack.id}&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${origin}${FACULTY_MEMBERSHIP_HREF}?cora_pack=cancel`,
        }

    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [packLineItem(pack)],
      success_url: returnUrls.success_url,
      cancel_url: returnUrls.cancel_url,
      metadata,
      payment_intent_data: { metadata },
    })

    return NextResponse.json({
      success: true,
      redirectUrl: checkoutSession.url,
      sessionId: checkoutSession.id,
      pack: { id: pack.id, credits: pack.credits, priceInCents: pack.priceInCents },
    })
  } catch (error) {
    console.error("[instructor/cora-credits/checkout]", error)
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: "Failed to start checkout", details: message }, { status: 500 })
  }
}
