import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { stripe } from "@/lib/stripe"
import { requirePlatformGuestDatabaseId } from "@/lib/require-platform-guest"
import { getGuestCoraCreditPack, resolveGuestCreditPackStripePriceId } from "@/lib/guest/membership-config"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  try {
    if (!stripe) {
      return NextResponse.json({ error: "Payment processing is not configured" }, { status: 503 })
    }

    const body = await request.json()
    const packId = String(body.packId ?? "").trim()
    const pack = getGuestCoraCreditPack(packId)
    if (!pack) return NextResponse.json({ error: "Invalid credit pack" }, { status: 400 })

    const guestId = await requirePlatformGuestDatabaseId(String(body.studentDatabaseId ?? "").trim())
    if (guestId == null) return NextResponse.json({ error: "Guest not found" }, { status: 404 })

    const students = (await sql`
      SELECT id, email, full_name, stripe_customer_id FROM students WHERE id = ${guestId} LIMIT 1
    `) as Array<{ id: number; email: string | null; full_name: string | null; stripe_customer_id: string | null }>
    const student = students[0]
    if (!student?.email?.trim()) {
      return NextResponse.json({ error: "Email required in Profile.", needsEmail: true }, { status: 400 })
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
    const metadata = {
      type: "guest_cora_credit_pack",
      audience: "guest",
      studentId: String(student.id),
      packId: pack.id,
      credits: String(pack.credits),
    }

    const priceId = resolveGuestCreditPackStripePriceId(pack.id)
    const lineItems = priceId
      ? [{ price: priceId, quantity: 1 }]
      : [{
          price_data: {
            currency: "usd",
            unit_amount: pack.priceCents,
            product_data: {
              name: pack.name,
              description: `${pack.credits.toLocaleString()} Cora Credits — never expire`,
            },
          },
          quantity: 1,
        }]

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer: customerId,
      line_items: lineItems,
      success_url: `${origin}/guest/cora-credits?success=1&pack=${pack.id}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/guest/cora-credits?cancelled=1`,
      metadata,
      payment_intent_data: { metadata },
    })

    return NextResponse.json({ url: session.url, sessionId: session.id })
  } catch (e) {
    console.error("[guest/cora-credits/checkout]", e)
    return NextResponse.json({ error: "Checkout failed" }, { status: 500 })
  }
}
