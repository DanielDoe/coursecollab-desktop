import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { stripe, STRIPE_PRODUCTS } from "@/lib/stripe"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function POST(request: NextRequest) {
  try {
    const { studentId, planId } = await request.json()

    if (!studentId || !planId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    if (planId === "Scholar") {
      return NextResponse.json({ error: "Cannot checkout for free plan" }, { status: 400 })
    }

    const students = await sql`
      SELECT id, student_id, full_name, email
      FROM students 
      WHERE id = ${studentId}
    `

    if (students.length === 0) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 })
    }

    const student = students[0]

    if (!student.email || student.email.includes("@student.placeholder.edu")) {
      return NextResponse.json(
        {
          error: "Please add your email address in your profile before purchasing a membership",
          needsEmail: true,
        },
        { status: 400 },
      )
    }

    const priceId = STRIPE_PRODUCTS[planId as keyof typeof STRIPE_PRODUCTS]

    if (!priceId) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 })
    }

    // Create or retrieve Stripe customer
    let customerId: string

    const existingCustomers = await stripe.customers.list({
      email: student.email,
      limit: 1,
    })

    if (existingCustomers.data.length > 0) {
      customerId = existingCustomers.data[0].id
    } else {
      const customer = await stripe.customers.create({
        email: student.email,
        name: student.full_name,
        metadata: {
          studentId: student.id.toString(),
        },
      })
      customerId = customer.id
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      ui_mode: "embedded",
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      return_url: `${request.nextUrl.origin}/student/membership/success?session_id={CHECKOUT_SESSION_ID}`,
      metadata: {
        studentId: student.id.toString(),
        planId,
      },
    })

    return NextResponse.json({ clientSecret: session.client_secret })
  } catch (error) {
    console.error("Checkout error:", error)
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 })
  }
}
