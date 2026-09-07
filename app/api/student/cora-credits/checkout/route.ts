import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { stripe } from "@/lib/stripe"
import { getCoraPack } from "@/lib/cora/credits/packs"
import { packLineItem } from "@/lib/cora/credits/fulfill-purchase"
import { mobileStudentCoraPackReturnUrls } from "@/lib/mobile-membership-return-urls"
import { STUDENT_MEMBERSHIP_V2 } from "@/lib/student-v2-routes"

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
    const studentId = parseInt(String(body.studentId ?? ""), 10)
    const packId = String(body.packId ?? "")
    const mobile = body.mobile === true || body.platform === "mobile"
    const pack = getCoraPack(packId)

    if (!Number.isFinite(studentId) || studentId <= 0) {
      return NextResponse.json({ error: "Student ID required" }, { status: 400 })
    }
    if (!pack || pack.audience !== "student") {
      return NextResponse.json({ error: "Invalid Cora Credit Pack" }, { status: 400 })
    }

    const students = (await sql`
      SELECT id, email, full_name, stripe_customer_id FROM students WHERE id = ${studentId} LIMIT 1
    `) as Array<{
      id: number
      email: string | null
      full_name: string | null
      stripe_customer_id: string | null
    }>

    if (students.length === 0) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 })
    }

    const student = students[0]
    if (!student.email?.trim() || String(student.email).includes("@student.placeholder.edu")) {
      return NextResponse.json(
        {
          error: "Please add your email address in your profile before purchasing",
          needsEmail: true,
        },
        { status: 400 },
      )
    }

    let customerId = student.stripe_customer_id
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: student.email,
        name: student.full_name ?? undefined,
        metadata: { studentId: String(student.id) },
      })
      customerId = customer.id
      await sql`UPDATE students SET stripe_customer_id = ${customerId} WHERE id = ${student.id}`
    }

    const origin = request.nextUrl.origin
    const metadata = {
      type: "cora_credit_pack",
      audience: "student",
      studentId: String(student.id),
      packId: pack.id,
      credits: String(pack.credits),
    }

    const returnUrls = mobile
      ? mobileStudentCoraPackReturnUrls()
      : {
          success_url: `${origin}${STUDENT_MEMBERSHIP_V2}?cora_pack=success&pack=${pack.id}&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${origin}${STUDENT_MEMBERSHIP_V2}?cora_pack=cancel`,
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
    console.error("[student/cora-credits/checkout]", error)
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: "Failed to start checkout", details: message }, { status: 500 })
  }
}
