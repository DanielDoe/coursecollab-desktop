import { type NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { sql } from "@/lib/db"
import { stripe } from "@/lib/stripe"

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const { email, studentName } = await request.json()
    
    if (!email && !studentName) {
      return NextResponse.json({ error: "Email or student name required" }, { status: 400 })
    }

    console.log(`[Check Status] Checking membership for: ${email || studentName}`)
    
    // Find student by email or name
    const studentQuery = email 
      ? sql`SELECT id, student_id, full_name, email, membership_tier, stripe_customer_id, stripe_subscription_id FROM students WHERE email = ${email} LIMIT 1`
      : sql`SELECT id, student_id, full_name, email, membership_tier, stripe_customer_id, stripe_subscription_id FROM students WHERE full_name ILIKE ${`%${studentName}%`} LIMIT 1`
    
    const student = await studentQuery
    
    if (student.length === 0) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 })
    }
    
    const s = student[0]
    
    // Check memberships table
    const membership = await sql`
      SELECT id, tier, plan, status, expires_at, auto_renew, created_at, updated_at,
             stripe_customer_id, stripe_subscription_id
      FROM memberships
      WHERE student_id = ${s.id}
      ORDER BY created_at DESC
      LIMIT 1
    `
    
    // Check payments table (if it exists)
    let payments: any[] = []
    try {
      // First check if payments table exists
      const tableCheck = await sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'payments'
        ) as exists
      `
      
      if (tableCheck.length > 0 && tableCheck[0].exists) {
        payments = await sql`
          SELECT id, amount, status, stripe_invoice_id, stripe_checkout_session_id, created_at
          FROM payments
          WHERE student_id = ${s.id}
          ORDER BY created_at DESC
          LIMIT 10
        `
      } else {
        console.log("[Check Status] Payments table does not exist, skipping payment check")
      }
    } catch (error: any) {
      // Payments table might not exist or query failed
      console.log("[Check Status] Payments table not available:", error.message)
    }
    
    // Check Stripe if customer ID exists
    let stripeData: any = null
    if (s.stripe_customer_id) {
      try {
        const customer = await stripe.customers.retrieve(s.stripe_customer_id)
        const subscriptions = await stripe.subscriptions.list({
          customer: s.stripe_customer_id,
          status: 'all',
          limit: 10
        })
        
        const invoices = await stripe.invoices.list({
          customer: s.stripe_customer_id,
          limit: 10
        })
        
        stripeData = {
          customer: {
            id: customer.id,
            email: customer.email,
            created: new Date(customer.created * 1000).toISOString()
          },
          subscriptions: subscriptions.data.map(sub => ({
            id: sub.id,
            status: sub.status,
            priceId: sub.items.data[0]?.price.id,
            amount: sub.items.data[0]?.price.unit_amount ? (sub.items.data[0].price.unit_amount / 100) : 0,
            created: new Date(sub.created * 1000).toISOString(),
            currentPeriodStart: new Date(sub.current_period_start * 1000).toISOString(),
            currentPeriodEnd: new Date(sub.current_period_end * 1000).toISOString()
          })),
          invoices: invoices.data.map(inv => ({
            id: inv.id,
            amount: (inv.amount_paid / 100).toFixed(2),
            status: inv.status,
            created: new Date(inv.created * 1000).toISOString(),
            subscription: inv.subscription
          }))
        }
      } catch (stripeError: any) {
        stripeData = { error: stripeError.message }
      }
    }
    
    // Determine plan from Stripe subscription
    let detectedPlan = 'Scholar'
    if (stripeData?.subscriptions) {
      const activeSubs = stripeData.subscriptions.filter((sub: any) => 
        sub.status === 'active' || sub.status === 'trialing'
      )
      
      if (activeSubs.length > 0) {
        const { STRIPE_PRODUCTS } = await import("@/lib/stripe")
        for (const sub of activeSubs) {
          if (sub.priceId === STRIPE_PRODUCTS.Trailblazer) {
            detectedPlan = 'Trailblazer'
            break
          } else if (sub.priceId === STRIPE_PRODUCTS.Explorer && detectedPlan !== 'Trailblazer') {
            detectedPlan = 'Explorer'
          }
        }
      }
    }
    
    // Summary
    const hasMembership = membership.length > 0 && membership[0].status === 'active'
    const hasPayment = payments.length > 0 && payments.some((p: any) => p.status === 'succeeded')
    const tierMatches = s.membership_tier === (membership[0]?.tier || membership[0]?.plan)
    const stripeMatches = s.membership_tier === detectedPlan
    
    return NextResponse.json({
      student: {
        id: s.id,
        studentId: s.student_id,
        fullName: s.full_name,
        email: s.email,
        membershipTier: s.membership_tier || 'Scholar',
        stripeCustomerId: s.stripe_customer_id,
        stripeSubscriptionId: s.stripe_subscription_id
      },
      membership: membership.length > 0 ? {
        id: membership[0].id,
        tier: membership[0].tier || membership[0].plan,
        status: membership[0].status,
        expiresAt: membership[0].expires_at,
        autoRenew: membership[0].auto_renew,
        createdAt: membership[0].created_at,
        updatedAt: membership[0].updated_at,
        stripeCustomerId: membership[0].stripe_customer_id,
        stripeSubscriptionId: membership[0].stripe_subscription_id
      } : null,
      payments: payments.map((p: any) => ({
        id: p.id,
        amount: parseFloat(p.amount),
        status: p.status,
        stripeInvoiceId: p.stripe_invoice_id,
        stripeCheckoutSessionId: p.stripe_checkout_session_id,
        createdAt: p.created_at
      })),
      stripe: stripeData,
      detectedPlan,
      summary: {
        hasMembership,
        hasPayment,
        tierMatches,
        stripeMatches,
        issues: []
      },
      recommendations: []
    })
  } catch (error: any) {
    console.error("[Check Status] Error:", error)
    return NextResponse.json(
      { error: "Failed to check status", details: error.message },
      { status: 500 }
    )
  }
}

