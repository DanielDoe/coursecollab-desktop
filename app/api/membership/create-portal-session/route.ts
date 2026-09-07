import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { stripe } from "@/lib/stripe"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function POST(request: NextRequest) {
  try {
    const { studentId } = await request.json()

    if (!studentId) {
      return NextResponse.json({ error: "Missing studentId" }, { status: 400 })
    }

    // Get student's Stripe customer ID
    const students = await sql`
      SELECT stripe_customer_id 
      FROM students 
      WHERE id = ${studentId}
    `

    if (students.length === 0 || !students[0].stripe_customer_id) {
      return NextResponse.json({ error: "No Stripe customer found" }, { status: 404 })
    }

    const customerId = students[0].stripe_customer_id

    // Create Stripe billing portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${request.nextUrl.origin}/student/membership/manage`,
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error("[v0] Portal session error:", error)
    return NextResponse.json({ error: "Failed to create portal session" }, { status: 500 })
  }
}
