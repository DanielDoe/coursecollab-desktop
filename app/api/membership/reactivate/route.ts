import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { stripe } from "@/lib/stripe"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function POST(request: NextRequest) {
  try {
    if (!stripe) {
      return NextResponse.json({ error: "Stripe is not configured" }, { status: 500 })
    }

    const { studentId } = await request.json()

    if (!studentId) {
      return NextResponse.json({ error: "Missing studentId" }, { status: 400 })
    }

    // Get student's subscription ID and current tier
    const students = await sql`
      SELECT 
        stripe_subscription_id,
        membership_tier,
        stripe_customer_id
      FROM students 
      WHERE id = ${parseInt(studentId)}
    `

    if (students.length === 0) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 })
    }

    const student = students[0]

    if (!student.stripe_subscription_id) {
      return NextResponse.json({ error: "No active subscription found" }, { status: 404 })
    }

    const subscriptionId = student.stripe_subscription_id

    // Reactivate subscription (remove cancel_at_period_end)
    const subscription = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: false,
    })

    console.log(`[Reactivate Membership] Subscription ${subscriptionId} reactivated`)

    // Determine tier from subscription
    const { STRIPE_PRODUCTS } = await import("@/lib/stripe")
    const priceId = subscription.items.data[0]?.price.id
    let planId = subscription.metadata?.planId
    
    if (!planId && priceId) {
      if (priceId === STRIPE_PRODUCTS.Explorer) {
        planId = 'Explorer'
      } else if (priceId === STRIPE_PRODUCTS.Trailblazer) {
        planId = 'Trailblazer'
      } else {
        planId = 'Scholar'
      }
    }

    // Update database
    await sql`
      UPDATE memberships
      SET 
        cancel_at_period_end = false,
        auto_renew = true,
        tier = ${planId || 'Scholar'},
        plan = ${planId || 'Scholar'},
        status = 'active',
        updated_at = CURRENT_TIMESTAMP
      WHERE student_id = ${parseInt(studentId)} AND stripe_subscription_id = ${subscriptionId}
    `

    // Update students table
    await sql`
      UPDATE students
      SET membership_tier = ${planId || 'Scholar'}
      WHERE id = ${parseInt(studentId)}
    `

    // Grant perks for the reactivated tier
    if (planId && planId !== 'Scholar') {
      try {
        const { grantMembershipPerks } = await import("@/lib/membership")
        await grantMembershipPerks(parseInt(studentId), planId as any)
        console.log(`[Reactivate Membership] Granted perks for ${planId} tier`)
      } catch (error) {
        console.error("[Reactivate Membership] Failed to grant perks:", error)
      }
    }

    return NextResponse.json({ 
      success: true,
      message: "Subscription reactivated successfully",
      plan: planId
    })
  } catch (error: any) {
    console.error("[Reactivate Membership] Error reactivating subscription:", error)
    return NextResponse.json({ 
      error: "Failed to reactivate subscription",
      details: error.message 
    }, { status: 500 })
  }
}
