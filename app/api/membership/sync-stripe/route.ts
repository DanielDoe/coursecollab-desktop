import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { stripe, STRIPE_PRODUCTS } from "@/lib/stripe"
import { getSemesterEndDate } from "@/lib/semester-utils"

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { studentId } = body

    if (!studentId) {
      return NextResponse.json({ error: "Student ID required" }, { status: 400 })
    }

    console.log(`[Sync Stripe] Syncing membership for student ${studentId}...`)

    // Get student info
    const students = await sql`
      SELECT id, student_id, full_name, email, stripe_customer_id, membership_tier
      FROM students
      WHERE id = ${parseInt(studentId)}
      LIMIT 1
    `

    if (students.length === 0) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 })
    }

    const student = students[0]

    // If no Stripe customer ID, try to find by email
    let customerId = student.stripe_customer_id
    if (!customerId && student.email) {
      try {
        const customers = await stripe.customers.list({
          email: student.email,
          limit: 1
        })
        if (customers.data.length > 0) {
          customerId = customers.data[0].id
          // Update student with customer ID
          await sql`
            UPDATE students
            SET stripe_customer_id = ${customerId}
            WHERE id = ${parseInt(studentId)}
          `
        }
      } catch (error) {
        console.error(`[Sync Stripe] Error finding customer by email:`, error)
      }
    }

    if (!customerId) {
      return NextResponse.json({ 
        error: "No Stripe customer found for this student",
        updated: false,
        created: false
      })
    }

    // Get all active subscriptions for this customer
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'all',
      limit: 100
    })

    const activeSubscriptions = subscriptions.data.filter(sub => 
      sub.status === 'active' || sub.status === 'trialing'
    )

    // Determine highest tier from active subscriptions
    let highestTier = "Scholar"
    let subscriptionId: string | null = null
    let billingCadence: "monthly" | "semester" = "monthly"

    for (const sub of activeSubscriptions) {
      const priceId = sub.items.data[0]?.price.id
      if (priceId === STRIPE_PRODUCTS.Trailblazer || priceId === STRIPE_PRODUCTS.Trailblazer_Semester) {
        highestTier = "Trailblazer"
        subscriptionId = sub.id
        billingCadence = priceId === STRIPE_PRODUCTS.Trailblazer_Semester ? "semester" : "monthly"
        break // Trailblazer is highest
      } else if (priceId === STRIPE_PRODUCTS.Explorer || priceId === STRIPE_PRODUCTS.Explorer_Semester) {
        if (highestTier !== "Trailblazer") {
          highestTier = "Explorer"
          subscriptionId = sub.id
          billingCadence = priceId === STRIPE_PRODUCTS.Explorer_Semester ? "semester" : "monthly"
        }
      }
    }

    // Also check for one-time payments (semester plans)
    if (highestTier === "Scholar") {
      try {
        const paymentIntents = await stripe.paymentIntents.list({
          customer: customerId,
          limit: 10
        })

        for (const pi of paymentIntents.data) {
          if (pi.status === 'succeeded' && pi.metadata?.planId) {
            const planId = pi.metadata.planId
            if (planId === "Trailblazer" || planId === "Explorer") {
              // Check if this is a semester payment
              const isSemester = pi.metadata.billingCadence === "semester"
              if (planId === "Trailblazer") {
                highestTier = "Trailblazer"
                billingCadence = isSemester ? "semester" : "monthly"
              } else if (planId === "Explorer" && highestTier !== "Trailblazer") {
                highestTier = "Explorer"
                billingCadence = isSemester ? "semester" : "monthly"
              }
            }
          }
        }
      } catch (error) {
        console.error(`[Sync Stripe] Error checking payment intents:`, error)
      }
    }

    // Update student membership tier
    await sql`
      UPDATE students
      SET 
        membership_tier = ${highestTier},
        stripe_customer_id = ${customerId},
        stripe_subscription_id = ${subscriptionId || null}
      WHERE id = ${parseInt(studentId)}
    `

    // Calculate expiration date
    const semesterEndDate = await getSemesterEndDate()
    const expiresAt = billingCadence === "semester"
      ? semesterEndDate.toISOString()
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    const autoRenew = billingCadence !== "semester"

    // Update or create membership record
    const existingMembership = await sql`
      SELECT id FROM memberships 
      WHERE student_id = ${parseInt(studentId)}
        AND (deleted_at IS NULL OR deleted_at IS NOT NULL)
      LIMIT 1
    `

    let updated = false
    let created = false

    if (existingMembership.length > 0) {
      // Update existing membership
      await sql`
        UPDATE memberships
        SET
          tier = ${highestTier},
          plan = ${highestTier},
          stripe_customer_id = ${customerId},
          stripe_subscription_id = ${subscriptionId || null},
          billing_cadence = ${billingCadence},
          status = 'active',
          expires_at = ${expiresAt}::timestamp,
          end_date = ${expiresAt}::timestamp,
          auto_renew = ${autoRenew},
          updated_at = CURRENT_TIMESTAMP,
          deleted_at = NULL
        WHERE student_id = ${parseInt(studentId)}
      `
      updated = true
    } else {
      // Create new membership
      await sql`
        INSERT INTO memberships (
          student_id, tier, plan, stripe_customer_id, stripe_subscription_id, 
          billing_cadence, status, expires_at, end_date, auto_renew, start_date
        )
        VALUES (
          ${parseInt(studentId)},
          ${highestTier},
          ${highestTier},
          ${customerId},
          ${subscriptionId || null},
          ${billingCadence},
          'active',
          ${expiresAt}::timestamp,
          ${expiresAt}::timestamp,
          ${autoRenew},
          NOW()
        )
      `
      created = true
    }

    // Grant all perks for the tier
    try {
      const { grantMembershipPerks } = await import("@/lib/membership")
      await grantMembershipPerks(parseInt(studentId), highestTier as any)
      console.log(`[Sync Stripe] ✅ Granted all perks for ${highestTier} tier`)
    } catch (error) {
      console.error("[Sync Stripe] ⚠️ Failed to grant membership perks:", error)
    }

    console.log(`[Sync Stripe] ✅ Synced membership for student ${studentId}: ${highestTier} (${billingCadence})`)

    return NextResponse.json({
      success: true,
      studentId: parseInt(studentId),
      tier: highestTier,
      billingCadence,
      subscriptionId,
      updated,
      created
    })
  } catch (error: any) {
    console.error("[Sync Stripe] Error syncing membership:", error)
    return NextResponse.json({ 
      error: "Failed to sync membership from Stripe",
      details: error.message 
    }, { status: 500 })
  }
}
