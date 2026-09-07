import { NextResponse } from "next/server"
import { sql } from "@/lib/db"

import { stripe } from "@/lib/stripe"


export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function POST(request: Request) {
  try {
    const { studentId } = await request.json()

    if (!studentId) {
      return NextResponse.json({ error: "Student ID is required" }, { status: 400 })
    }

    // Get membership data from database
    const memberships = await sql`
      SELECT 
        m.plan,
        m.status,
        m.stripe_customer_id,
        m.stripe_subscription_id,
        m.start_date,
        m.end_date,
        m.created_at
      FROM memberships m
      WHERE m.student_id = ${studentId}
      LIMIT 1
    `

    if (memberships.length === 0) {
      // No membership found, user is on free tier
      return NextResponse.json({
        plan: "Scholar",
        status: "active",
        isFreeTier: true,
      })
    }

    const membership = memberships[0]

    // If user has a Stripe subscription, fetch details from Stripe
    if (membership.stripe_subscription_id) {
      try {
        if (!stripe) {
          console.error("Stripe is not configured")
          return NextResponse.json({
            plan: membership.plan,
            status: membership.status,
            isFreeTier: false,
          })
        }

        const subscription = await stripe.subscriptions.retrieve(membership.stripe_subscription_id)

        return NextResponse.json({
          plan: membership.plan,
          status: subscription.status,
          currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
          currentPeriodStart: new Date(subscription.current_period_start * 1000).toISOString(),
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          stripeCustomerId: membership.stripe_customer_id,
          stripeSubscriptionId: membership.stripe_subscription_id,
          isFreeTier: false,
        })
      } catch (stripeError) {
        console.error("Error fetching Stripe subscription:", stripeError)
        // Fall back to database data if Stripe fetch fails
        return NextResponse.json({
          plan: membership.plan,
          status: membership.status,
          isFreeTier: false,
        })
      }
    }

    // No Stripe subscription, return database data
    return NextResponse.json({
      plan: membership.plan,
      status: membership.status,
      isFreeTier: membership.plan === "Scholar",
    })
  } catch (error) {
    console.error("Get subscription error:", error)
    return NextResponse.json({ error: "Failed to fetch subscription data" }, { status: 500 })
  }
}
