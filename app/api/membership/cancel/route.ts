import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { stripe } from "@/lib/stripe"
import { requireStudentIdParamMatchesCaller } from "@/lib/student-api-auth"

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    if (!stripe) {
      return NextResponse.json({ error: "Stripe is not configured" }, { status: 500 })
    }

    const { studentId, subscriptionId: requestedSubId, immediate = false } = await request.json()

    if (!studentId) {
      return NextResponse.json({ error: "Missing studentId" }, { status: 400 })
    }

    const auth = await requireStudentIdParamMatchesCaller(request, String(studentId))
    if (!auth.ok) return auth.response

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

    let subscriptionId = requestedSubId || student.stripe_subscription_id

    if (!subscriptionId) {
      return NextResponse.json({ error: "No active subscription found" }, { status: 404 })
    }

    // If canceling a specific subscription, verify it belongs to this student's customer
    if (requestedSubId && student.stripe_customer_id) {
      const sub = await stripe.subscriptions.retrieve(requestedSubId)
      if (sub.customer !== student.stripe_customer_id) {
        return NextResponse.json({ error: "Subscription does not belong to this account" }, { status: 403 })
      }
      if (sub.status !== "active" && sub.status !== "trialing") {
        return NextResponse.json({ error: "Subscription is not active" }, { status: 400 })
      }
    }

    if (immediate) {
      // Cancel immediately - downgrade to Scholar right away
      await stripe.subscriptions.cancel(subscriptionId)
      
      console.log(`[Cancel Membership] Subscription ${subscriptionId} canceled immediately`)

      // Downgrade to Scholar immediately
      await sql`
        UPDATE students
        SET 
          membership_tier = 'Scholar',
          stripe_subscription_id = NULL
        WHERE id = ${parseInt(studentId)}
      `

      await sql`
        UPDATE memberships
        SET 
          status = 'canceled',
          plan = 'Scholar',
          end_date = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE student_id = ${parseInt(studentId)} AND stripe_subscription_id = ${subscriptionId}
      `

      // Grant Scholar perks (1 playground credit, 0 AI tutor credits)
      try {
        const { grantMembershipPerks } = await import("@/lib/membership")
        await grantMembershipPerks(parseInt(studentId), "Scholar")
        console.log(`[Cancel Membership] Granted Scholar perks after immediate cancellation`)
      } catch (error) {
        console.error("[Cancel Membership] Failed to grant Scholar perks:", error)
      }

      return NextResponse.json({ 
        success: true,
        message: "Subscription canceled immediately. You've been downgraded to Scholar tier.",
        immediate: true
      })
    } else {
      // Cancel at period end (default behavior - they keep access until period ends)
      const subscription = await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
      })

      console.log(`[Cancel Membership] Subscription ${subscriptionId} set to cancel at period end`)

      // Update database - mark as canceling at period end
      // Note: We keep the membership active until period ends, then webhook will handle downgrade
      await sql`
        UPDATE memberships
        SET 
          updated_at = CURRENT_TIMESTAMP
        WHERE student_id = ${parseInt(studentId)} AND stripe_subscription_id = ${subscriptionId}
      `

      // Note: We don't downgrade immediately - they keep access until period ends
      // The webhook will handle the actual downgrade when subscription is deleted
      console.log(`[Cancel Membership] Membership marked for cancellation at period end for student ${studentId}`)

      return NextResponse.json({ 
        success: true,
        message: "Subscription will be canceled at the end of the billing period",
        cancelAtPeriodEnd: true,
        currentPeriodEnd: subscription.current_period_end
      })
    }
  } catch (error: any) {
    console.error("[Cancel Membership] Error canceling subscription:", error)
    console.error("[Cancel Membership] Error details:", {
      message: error.message,
      code: error.code,
      type: error.type,
      studentId
    })
    return NextResponse.json({ 
      error: "Failed to cancel subscription",
      details: error.message,
      code: error.code || 'unknown'
    }, { status: 500 })
  }
}
