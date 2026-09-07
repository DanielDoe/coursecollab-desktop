import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { stripe } from "@/lib/stripe"
import { claimWebhookEvent } from "@/lib/compliance/webhook-idempotency"
import { getSemesterEndDate } from "@/lib/semester-utils"
import { ensureDonationsSchema } from "@/lib/ensure-donations-schema"
import {
  isProcessableStripeEvent,
  verifyStripeWebhookRequest,
} from "@/lib/stripe-webhook-guard"
import {
  isAuthorizedStudentMembershipCharge,
  isPaidCheckoutSession,
  isPaidMembershipTier,
  isSucceededPaymentIntent,
} from "@/lib/stripe-payment-guards"

import type Stripe from "stripe"
import type { MembershipTier } from "@/lib/membership-constants"

/** Two attempts so transient DB errors don’t leave paid members without perks */
async function grantPerksReliable(studentId: number, tier: MembershipTier): Promise<void> {
  const { grantMembershipPerks } = await import("@/lib/membership")
  let lastErr: unknown
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await grantMembershipPerks(studentId, tier)
      return
    } catch (e) {
      lastErr = e
      if (attempt === 0) await new Promise((r) => setTimeout(r, 400))
    }
  }
  console.error(`[Webhook] grantMembershipPerks failed after retry for student ${studentId}:`, lastErr)
  throw lastErr
}

export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function GET() {
  return new NextResponse(null, { status: 405, headers: { Allow: "POST" } })
}

export async function POST(request: NextRequest) {
  const verified = await verifyStripeWebhookRequest(request)
  if (!verified.ok) return verified.response
  const event = verified.event

  if (!isProcessableStripeEvent(event.type)) {
    return NextResponse.json({ received: true, ignored: true })
  }

  const claim = await claimWebhookEvent("stripe", event.id)
  if (claim === "duplicate") {
    return NextResponse.json({ received: true, duplicate: true })
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object as Stripe.Checkout.Session
        if (!isPaidCheckoutSession(session)) {
          console.error("[Webhook] Skipping unpaid checkout", {
            id: session.id,
            payment_status: session.payment_status,
          })
          break
        }
        if (session.metadata?.type === "cora_credit_pack") {
          await handleCoraCreditPackCheckout(session)
        } else if (session.metadata?.type === "donation") {
          await handleDonationCompleted(session)
        } else if (session.metadata?.type === "guest_cora_credit_pack") {
          await handleGuestCoraCreditPackCheckout(session)
        } else if (session.metadata?.type === "guest_career_lifetime") {
          await handleGuestCareerLifetimeCheckout(session)
        } else if (session.metadata?.type === "guest_career_essentials") {
          await handleGuestCareerLifetimeCheckout(session)
        } else if (session.metadata?.type === "guest_career_pass") {
          await handleGuestCareerPassCheckout(session)
        } else if (session.metadata?.audience === "instructor") {
          const { handleInstructorCheckoutCompleted } = await import("@/lib/instructor-membership-webhook")
          await handleInstructorCheckoutCompleted(session)
        } else if (session.metadata?.audience === "institution") {
          const { handleInstitutionCheckoutCompleted } = await import("@/lib/institutions/webhook")
          await handleInstitutionCheckoutCompleted(session)
        } else {
          await handleCheckoutCompleted(session)
        }
        break
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionUpdated(subscription)
        break
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionDeleted(subscription)
        break
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice
        await handlePaymentSucceeded(invoice)
        break
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice
        await handlePaymentFailed(invoice)
        break
      }

      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        if (!isSucceededPaymentIntent(paymentIntent)) {
          break
        }
        if (paymentIntent.metadata?.type === "cora_credit_pack") {
          await handleCoraCreditPackPaymentIntent(paymentIntent)
        } else if (paymentIntent.metadata?.type === "guest_cora_credit_pack") {
          await handleGuestCoraCreditPackPaymentIntent(paymentIntent)
        } else if (paymentIntent.metadata?.type === "guest_career_lifetime") {
          await handleGuestCareerLifetimePaymentIntent(paymentIntent)
        } else if (paymentIntent.metadata?.type === "guest_career_essentials") {
          await handleGuestCareerLifetimePaymentIntent(paymentIntent)
        } else if (
          paymentIntent.metadata?.audience === "instructor" &&
          paymentIntent.metadata?.instructorId &&
          paymentIntent.metadata?.planId
        ) {
          const { handleInstructorPaymentIntentSucceeded } = await import("@/lib/instructor-membership-webhook")
          await handleInstructorPaymentIntentSucceeded(paymentIntent)
        } else if (paymentIntent.metadata?.studentId && paymentIntent.metadata?.planId) {
          await handlePaymentIntentSucceeded(paymentIntent)
        }
        break
      }

      case "checkout.session.async_payment_failed": {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.metadata?.type === "donation") {
          await handleDonationFailed(session, "Payment failed")
        } else if (session.metadata?.audience === "instructor") {
          const { handleInstructorMembershipPaymentFailed } = await import("@/lib/instructor-membership-webhook")
          await handleInstructorMembershipPaymentFailed(session, "Payment failed")
        } else if (session.metadata?.studentId && session.metadata?.planId) {
          await handleMembershipPaymentFailed(session, "Payment failed")
        }
        break
      }

      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.metadata?.type === "donation") {
          await handleDonationFailed(session, "Checkout session expired")
        }
        break
      }
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error("Webhook handler error:", error)
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 })
  }
}

async function handleCoraCreditPackCheckout(session: Stripe.Checkout.Session) {
  const { fulfillCoraCreditPackPurchase } = await import("@/lib/cora/credits/fulfill-purchase")
  const audience = session.metadata?.audience === "instructor" ? "instructor" : "student"
  const packId = session.metadata?.packId || ""
  const buyerId = parseInt(
    String(
      audience === "instructor" ? session.metadata?.instructorId : session.metadata?.studentId,
    ),
    10,
  )
  if (!Number.isFinite(buyerId) || !packId) {
    console.error("[Webhook] cora_credit_pack missing buyer/pack", session.metadata)
    return
  }

  let studentTier: "Scholar" | "Explorer" | "Trailblazer" | undefined
  if (audience === "student") {
    try {
      const { getEffectiveMembershipTier } = await import("@/lib/membership")
      const tier = await getEffectiveMembershipTier(buyerId)
      if (tier === "Explorer" || tier === "Trailblazer" || tier === "Scholar") studentTier = tier
    } catch {
      studentTier = "Scholar"
    }
  }

  const result = await fulfillCoraCreditPackPurchase({
    stripeSessionId: session.id,
    audience,
    buyerId,
    packId,
    amountCents: session.amount_total ?? undefined,
    studentTier,
  })
  console.log(`[Webhook] cora_credit_pack fulfill:`, { sessionId: session.id, audience, buyerId, packId, result })
}

async function handleCoraCreditPackPaymentIntent(paymentIntent: Stripe.PaymentIntent) {
  const { fulfillCoraCreditPackPurchase } = await import("@/lib/cora/credits/fulfill-purchase")
  const audience = paymentIntent.metadata?.audience === "instructor" ? "instructor" : "student"
  const packId = paymentIntent.metadata?.packId || ""
  const buyerId = parseInt(
    String(
      audience === "instructor"
        ? paymentIntent.metadata?.instructorId
        : paymentIntent.metadata?.studentId,
    ),
    10,
  )
  if (!Number.isFinite(buyerId) || !packId) {
    console.error("[Webhook] cora_credit_pack PI missing buyer/pack", paymentIntent.metadata)
    return
  }

  let studentTier: "Scholar" | "Explorer" | "Trailblazer" | undefined
  if (audience === "student") {
    try {
      const { getEffectiveMembershipTier } = await import("@/lib/membership")
      const tier = await getEffectiveMembershipTier(buyerId)
      if (tier === "Explorer" || tier === "Trailblazer" || tier === "Scholar") studentTier = tier
    } catch {
      studentTier = "Scholar"
    }
  }

  const result = await fulfillCoraCreditPackPurchase({
    stripeSessionId: paymentIntent.id,
    audience,
    buyerId,
    packId,
    amountCents: paymentIntent.amount_received || paymentIntent.amount,
    studentTier,
  })
  console.log(`[Webhook] cora_credit_pack PI fulfill:`, {
    paymentIntentId: paymentIntent.id,
    audience,
    buyerId,
    packId,
    result,
  })
}

async function handleGuestCoraCreditPackPaymentIntent(paymentIntent: Stripe.PaymentIntent) {
  const studentId = parseInt(String(paymentIntent.metadata?.studentId ?? ""), 10)
  const packId = String(paymentIntent.metadata?.packId ?? "").trim()
  if (!Number.isFinite(studentId) || studentId <= 0 || !packId) {
    console.error("[Webhook] guest_cora_credit_pack PI missing studentId/packId", paymentIntent.metadata)
    return
  }
  const { fulfillGuestCreditPackPurchase } = await import("@/lib/guest/fulfill-membership")
  const result = await fulfillGuestCreditPackPurchase({
    stripeSessionId: paymentIntent.id,
    studentId,
    packId,
    amountCents: paymentIntent.amount_received || paymentIntent.amount,
    currency: paymentIntent.currency ?? "usd",
  })
  if (!result.ok) {
    console.error("[Webhook] guest_cora_credit_pack PI fulfill failed:", result.error, paymentIntent.id)
    throw new Error(result.error ?? "Guest credit pack fulfillment failed")
  }
  console.log(`[Webhook] guest_cora_credit_pack PI fulfilled for guest ${studentId}`, {
    paymentIntentId: paymentIntent.id,
    packId,
    alreadyFulfilled: result.alreadyFulfilled,
  })
}

async function handleGuestCareerLifetimePaymentIntent(paymentIntent: Stripe.PaymentIntent) {
  const studentId = parseInt(String(paymentIntent.metadata?.studentId ?? ""), 10)
  if (!Number.isFinite(studentId) || studentId <= 0) {
    console.error("[Webhook] guest career PI missing studentId", paymentIntent.metadata)
    return
  }
  const rawPlan = String(paymentIntent.metadata?.plan ?? "cora_career")
  const plan =
    rawPlan === "cora_career_essentials" ? ("cora_career_essentials" as const) : ("cora_career" as const)
  const { fulfillGuestCareerPlanPurchase } = await import("@/lib/guest/fulfill-membership")
  const result = await fulfillGuestCareerPlanPurchase({
    stripeSessionId: paymentIntent.id,
    studentId,
    plan,
    amountCents: paymentIntent.amount_received || paymentIntent.amount,
    currency: paymentIntent.currency ?? "usd",
  })
  if (!result.ok) {
    console.error("[Webhook] guest career PI fulfill failed:", result.error, paymentIntent.id)
    throw new Error(result.error ?? "Guest Cora Career fulfillment failed")
  }
  console.log(`[Webhook] guest career ${plan} PI fulfilled for guest ${studentId}`, {
    paymentIntentId: paymentIntent.id,
    alreadyFulfilled: result.alreadyFulfilled,
  })
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const studentId = session.metadata?.studentId
  const planId = session.metadata?.planId
  const billingCadence = session.metadata?.billingCadence as "monthly" | "semester" | undefined
  const isSemester = billingCadence === "semester"

  console.log(`[Webhook] Processing checkout.session.completed:`, {
    sessionId: session.id,
    customerId: session.customer,
    subscriptionId: session.subscription,
    studentId,
    planId,
    billingCadence,
    isSemester,
    metadata: session.metadata,
    paymentStatus: session.payment_status,
    status: session.status,
    mode: session.mode // "subscription" for monthly, "payment" for semester
  })

  if (!studentId || !isPaidMembershipTier(planId)) {
    console.error(`[Webhook] ❌ Missing metadata in checkout session ${session.id}:`, {
      hasStudentId: !!studentId,
      hasPlanId: !!planId,
      allMetadata: session.metadata,
      customerEmail: session.customer_email
    })
    
    // Try to find student by customer email as fallback
    if (session.customer_email && !studentId) {
      console.log(`[Webhook] Attempting to find student by email: ${session.customer_email}`)
      try {
        const studentByEmail = await sql`
          SELECT id, full_name, email FROM students WHERE email = ${session.customer_email} LIMIT 1
        `
        if (studentByEmail.length > 0) {
          const foundStudent = studentByEmail[0]
          console.log(`[Webhook] ✅ Found student by email: ${foundStudent.full_name} (ID: ${foundStudent.id})`)
          // Update the session metadata would require re-processing, but we can log it
          // For now, we'll need to manually fix or use the sync function
        }
      } catch (error) {
        console.error(`[Webhook] Failed to find student by email:`, error)
      }
    }
    return
  }

  if (
    !isAuthorizedStudentMembershipCharge(
      planId,
      isSemester ? "semester" : "monthly",
      session.amount_total,
    )
  ) {
    console.error("[Webhook] Refusing membership grant: amount does not match catalog", {
      sessionId: session.id,
      planId,
      amount_total: session.amount_total,
      cadence: isSemester ? "semester" : "monthly",
    })
    return
  }

  // For semester plans, there's no subscription (one-time payment)
  const subscriptionId = isSemester ? null : (session.subscription as string)
  
  // Get the actual payment amount from Stripe
  let paymentAmount = 0
  try {
    const sessionDetails = await stripe.checkout.sessions.retrieve(session.id, {
      expand: ['line_items']
    })
    paymentAmount = sessionDetails.amount_total ? (sessionDetails.amount_total / 100) : 0
    
    // If subscription exists (monthly), get the price from subscription
    if (subscriptionId && !isSemester) {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId)
      const priceId = subscription.items.data[0]?.price.id
      if (priceId) {
        const price = await stripe.prices.retrieve(priceId)
        paymentAmount = price.unit_amount ? (price.unit_amount / 100) : paymentAmount
      }
    } else if (isSemester && sessionDetails.line_items?.data?.[0]) {
      // For semester (one-time payment), get amount from line items
      const lineItem = sessionDetails.line_items.data[0]
      paymentAmount = lineItem.amount_total ? (lineItem.amount_total / 100) : paymentAmount
    }
  } catch (error) {
    console.error("[Webhook] Failed to retrieve payment amount:", error)
    // Use default based on plan and cadence
    if (planId === 'Explorer') {
      paymentAmount = isSemester ? 19.99 : 5.99
    } else if (planId === 'Trailblazer') {
      paymentAmount = isSemester ? 39.99 : 9.99
    }
  }

  // Check for existing active subscriptions to determine highest tier (only for monthly)
  let finalPlanId = planId
  let finalSubscriptionId = subscriptionId
  if (subscriptionId && !isSemester) {
    try {
      const allSubscriptions = await stripe.subscriptions.list({
        customer: session.customer as string,
        status: 'all',
        limit: 100
      })
      
      const activeSubs = allSubscriptions.data.filter(sub => 
        sub.status === 'active' || sub.status === 'trialing'
      )
      
      // Determine highest tier from all active subscriptions
      const { STRIPE_PRODUCTS } = await import("@/lib/stripe")
      for (const sub of activeSubs) {
        const subPriceId = sub.items.data[0]?.price.id
        if (subPriceId === STRIPE_PRODUCTS.Trailblazer) {
          finalPlanId = 'Trailblazer'
          break // Trailblazer is highest
        } else if (subPriceId === STRIPE_PRODUCTS.Explorer && finalPlanId !== 'Trailblazer') {
          finalPlanId = 'Explorer'
        }
      }
      
      if (activeSubs.length > 1) {
        console.log(`[Webhook] Warning: Customer has ${activeSubs.length} active subscriptions. Canceling duplicates...`)
        // Auto-cancel older duplicate subscriptions to prevent double billing
        const sortedByCreated = [...activeSubs].sort((a, b) => a.created - b.created)
        const keepSub = sortedByCreated[sortedByCreated.length - 1] // Keep newest
        finalSubscriptionId = keepSub.id
        for (const sub of sortedByCreated) {
          if (sub.id !== keepSub.id) {
            try {
              await stripe.subscriptions.cancel(sub.id)
              console.log(`[Webhook] ✅ Canceled duplicate subscription: ${sub.id}`)
            } catch (cancelErr: any) {
              console.error(`[Webhook] Failed to cancel duplicate ${sub.id}:`, cancelErr?.message)
            }
          }
        }
      }
    } catch (error) {
      console.error("[Webhook] Error checking for duplicate subscriptions:", error)
    }

    // Set cancel_at to semester end so monthly subs stop at semester (no charges after, no refunds needed)
    if (finalSubscriptionId) {
      try {
        const semesterEnd = await getSemesterEndDate()
        const cancelAt = Math.floor(semesterEnd.getTime() / 1000)
        await stripe.subscriptions.update(finalSubscriptionId, { cancel_at: cancelAt })
        console.log(`[Webhook] Set subscription ${finalSubscriptionId} to cancel at semester end (${semesterEnd.toISOString()})`)
      } catch (cancelErr: any) {
        console.error("[Webhook] Failed to set cancel_at on subscription:", cancelErr?.message)
      }
    }
  }

  // Update student membership
  await sql`
    UPDATE students
    SET 
      membership_tier = ${finalPlanId},
      stripe_customer_id = ${session.customer as string},
      stripe_subscription_id = ${finalSubscriptionId || null}
    WHERE id = ${Number.parseInt(studentId)}
  `

  // Check if existing membership exists and is not deleted
  // First check if deleted_at column exists
  let hasDeletedAtColumn = false
  try {
    const columnCheck = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'memberships' AND column_name = 'deleted_at'
    `
    hasDeletedAtColumn = columnCheck.length > 0
  } catch (e) {
    // Ignore - assume column doesn't exist
  }

  const existingMembership = hasDeletedAtColumn
    ? await sql`
        SELECT id FROM memberships 
        WHERE student_id = ${Number.parseInt(studentId)} 
          AND deleted_at IS NULL
      `
    : await sql`
        SELECT id FROM memberships 
        WHERE student_id = ${Number.parseInt(studentId)}
      `
  
  // Calculate expiration date: both monthly and semester end at semester end
  // Monthly subs are set to cancel_at semester end to avoid charging students who forgot to cancel
  const semesterEndDate = await getSemesterEndDate()
  const expiresAt = semesterEndDate.toISOString()
  const autoRenew = false // All plans end at semester; no auto-renew to avoid forgotten cancellations

  if (existingMembership.length > 0) {
    // Update existing membership
    const updateQuery = hasDeletedAtColumn
      ? sql`
          UPDATE memberships
          SET
            tier = ${finalPlanId},
            plan = ${finalPlanId},
            stripe_customer_id = ${session.customer as string},
            stripe_subscription_id = ${finalSubscriptionId},
            billing_cadence = ${billingCadence || 'monthly'},
            status = 'active',
            expires_at = ${expiresAt}::timestamp,
            end_date = ${expiresAt}::timestamp,
            auto_renew = ${autoRenew},
            updated_at = CURRENT_TIMESTAMP,
            deleted_at = NULL
          WHERE student_id = ${Number.parseInt(studentId)}
            AND deleted_at IS NULL
        `
      : sql`
          UPDATE memberships
          SET
            tier = ${finalPlanId},
            plan = ${finalPlanId},
            stripe_customer_id = ${session.customer as string},
            stripe_subscription_id = ${finalSubscriptionId},
            billing_cadence = ${billingCadence || 'monthly'},
            status = 'active',
            expires_at = ${expiresAt}::timestamp,
            end_date = ${expiresAt}::timestamp,
            auto_renew = ${autoRenew},
            updated_at = CURRENT_TIMESTAMP
          WHERE student_id = ${Number.parseInt(studentId)}
        `
    await updateQuery
  } else {
    // Create new membership - use finalPlanId (highest tier) not just planId
    await sql`
      INSERT INTO memberships (
        student_id, tier, plan, stripe_customer_id, stripe_subscription_id, billing_cadence, status, expires_at, end_date, auto_renew, start_date
      )
      VALUES (
        ${Number.parseInt(studentId)},
        ${finalPlanId},
        ${finalPlanId},
        ${session.customer as string},
        ${finalSubscriptionId},
        ${billingCadence || 'monthly'},
        'active',
        ${expiresAt}::timestamp,
        ${expiresAt}::timestamp,
        ${autoRenew},
        NOW()
      )
    `
    console.log(`[Webhook] Created new membership for student ${studentId} with tier ${finalPlanId}, cadence: ${billingCadence || 'monthly'}`)
  }

  // Record payment in payments table if it exists
  try {
    // Check if payments table exists and has required columns
    const paymentsTableCheck = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'payments' AND column_name IN ('student_id', 'amount', 'status')
    `
    
    if (paymentsTableCheck.length >= 3) {
      // Try to insert, but handle duplicate key errors gracefully
      try {
        await sql`
          INSERT INTO payments (student_id, amount, status, stripe_invoice_id, stripe_checkout_session_id, created_at)
          VALUES (
            ${Number.parseInt(studentId)},
            ${paymentAmount},
            'succeeded',
            ${finalSubscriptionId || null},
            ${session.id},
            NOW()
          )
          ON CONFLICT (stripe_checkout_session_id) DO UPDATE SET
            amount = ${paymentAmount},
            status = 'succeeded',
            stripe_invoice_id = ${finalSubscriptionId || null}
        `
        console.log(`[Webhook] ✅ Recorded payment for membership upgrade: $${paymentAmount}`)
      } catch (insertError: any) {
        // If ON CONFLICT doesn't work, try regular insert
        if (insertError.code === '23505') {
          console.log(`[Webhook] Payment already exists for session ${session.id}, skipping`)
        } else {
          await sql`
            INSERT INTO payments (student_id, amount, status, stripe_invoice_id, stripe_checkout_session_id, created_at)
            VALUES (
              ${Number.parseInt(studentId)},
              ${paymentAmount},
              'succeeded',
              ${finalSubscriptionId || null},
              ${session.id},
              NOW()
            )
          `
          console.log(`[Webhook] ✅ Recorded payment for membership upgrade: $${paymentAmount}`)
        }
      }
    } else {
      console.log("[Webhook] Payments table structure incomplete, skipping payment record")
    }
  } catch (error: any) {
    // Payments table might not exist, that's okay
    console.log(`[Webhook] Payments table not available or error: ${error.message}, skipping payment record`)
  }

  // Send payment success email (non-blocking)
  try {
    const studentRow = await sql`SELECT full_name, email FROM students WHERE id = ${Number.parseInt(studentId)} LIMIT 1`
    if (studentRow[0]?.email && !String(studentRow[0].email).endsWith("@student.placeholder.edu")) {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://course-collab.com"
      const { sendEmail } = await import("@/lib/email/sendEmail")
      await sendEmail("payment_success", studentRow[0].email as string, {
        name: (studentRow[0].full_name as string) || "Student",
        amount: paymentAmount.toFixed(2),
        description: `${finalPlanId} membership (${billingCadence === "semester" ? "Semester" : "Monthly"})`,
        link: `${baseUrl}/student/membership`,
      })
    }
  } catch (emailErr) {
    console.warn("[Webhook] Payment success email failed:", emailErr)
  }

    // Verify the membership was created/updated
    const verifyMembership = await sql`
      SELECT id, tier, plan, status FROM memberships WHERE student_id = ${Number.parseInt(studentId)} LIMIT 1
    `
    
    const verifyStudent = await sql`
      SELECT id, membership_tier, stripe_customer_id, stripe_subscription_id FROM students WHERE id = ${Number.parseInt(studentId)} LIMIT 1
    `
    
    console.log(`[Webhook] ✅ Membership activated for student ${studentId}:`, {
      planId: finalPlanId,
      paymentAmount: `$${paymentAmount}`,
      subscriptionId: finalSubscriptionId,
      membershipRecord: verifyMembership.length > 0 ? {
        id: verifyMembership[0].id,
        tier: verifyMembership[0].tier || verifyMembership[0].plan,
        status: verifyMembership[0].status
      } : 'NOT FOUND',
      studentRecord: verifyStudent.length > 0 ? {
        membershipTier: verifyStudent[0].membership_tier,
        hasCustomerId: !!verifyStudent[0].stripe_customer_id,
        hasSubscriptionId: !!verifyStudent[0].stripe_subscription_id
      } : 'NOT FOUND'
    })

    // Send payment success email
    try {
      const { getStudentForEmail } = await import("@/lib/email/send-notification-email")
      const { sendEmail } = await import("@/lib/email/sendEmail")
      const student = await getStudentForEmail(Number.parseInt(studentId))
      if (student?.email) {
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://course-collab.com"
        const desc = isSemester ? `${finalPlanId} (Semester)` : `${finalPlanId} (Monthly)`
        sendEmail("payment_success", student.email, {
          name: student.name,
          amount: paymentAmount.toFixed(2),
          description: desc,
          link: `${baseUrl}/student/membership`,
        }).catch((e) => console.warn("[Webhook] Payment email error:", e))
      }
    } catch (e) {
      console.warn("[Webhook] Payment email error:", e)
    }
    
    // CRITICAL: If verification fails, retry the upgrade
    if (verifyMembership.length === 0 || verifyStudent.length === 0 || verifyStudent[0].membership_tier !== finalPlanId) {
      console.error(`[Webhook] ❌ CRITICAL: Verification failed. Retrying upgrade...`, {
        studentId,
        expectedTier: finalPlanId,
        membershipExists: verifyMembership.length > 0,
        studentTier: verifyStudent[0]?.membership_tier,
        subscriptionId: finalSubscriptionId
      })
      
      // Retry: Update student tier
      await sql`
        UPDATE students
        SET 
          membership_tier = ${finalPlanId},
          stripe_customer_id = ${session.customer as string},
          stripe_subscription_id = ${finalSubscriptionId || null}
        WHERE id = ${Number.parseInt(studentId)}
      `
      
      // Retry: Update or create membership
      const retryMembership = await sql`
        SELECT id FROM memberships 
        WHERE student_id = ${Number.parseInt(studentId)} 
          AND (deleted_at IS NULL OR deleted_at IS NOT NULL)
      `
      
      if (retryMembership.length > 0) {
        await sql`
          UPDATE memberships
          SET
            tier = ${finalPlanId},
            plan = ${finalPlanId},
            stripe_customer_id = ${session.customer as string},
            stripe_subscription_id = ${finalSubscriptionId},
            status = 'active',
            expires_at = NOW() + INTERVAL '1 month',
            end_date = NOW() + INTERVAL '1 month',
            auto_renew = true,
            updated_at = CURRENT_TIMESTAMP,
            deleted_at = NULL
          WHERE student_id = ${Number.parseInt(studentId)}
        `
      } else {
        await sql`
          INSERT INTO memberships (
            student_id, tier, plan, stripe_customer_id, stripe_subscription_id, 
            status, expires_at, end_date, auto_renew, start_date
          )
          VALUES (
            ${Number.parseInt(studentId)},
            ${finalPlanId},
            ${finalPlanId},
            ${session.customer as string},
            ${finalSubscriptionId},
            'active',
            NOW() + INTERVAL '1 month',
            NOW() + INTERVAL '1 month',
            true,
            NOW()
          )
        `
      }
      
      // Verify again after retry
      const retryVerify = await sql`
        SELECT id, membership_tier FROM students WHERE id = ${Number.parseInt(studentId)} LIMIT 1
      `
      
      if (retryVerify.length > 0 && retryVerify[0].membership_tier === finalPlanId) {
        console.log(`[Webhook] ✅ Retry successful - student ${studentId} upgraded to ${finalPlanId}`)
      } else {
        console.error(`[Webhook] ❌ CRITICAL: Retry failed - student ${studentId} still not upgraded. Manual intervention required.`)
      }
    }
    
    // Grant all perks for the upgraded tier (including retake access for Explorer/Trailblazer)
    try {
      await grantPerksReliable(parseInt(studentId), finalPlanId as MembershipTier)
      console.log(`[Webhook] ✅ Granted all perks for ${finalPlanId} tier`)
      
      // Verify retake access for Explorer/Trailblazer members
      if (finalPlanId === "Explorer" || finalPlanId === "Trailblazer") {
        const { hasRetakeAccess } = await import("@/lib/retake-access")
        const retakeAccess = await hasRetakeAccess(parseInt(studentId))
        console.log(`[Webhook] ✅ Verified retake access for ${finalPlanId}: ${retakeAccess ? "GRANTED" : "NOT GRANTED"}`)
        if (!retakeAccess) {
          console.error(`[Webhook] ⚠️ WARNING: ${finalPlanId} member should have retake access but check returned false`)
        }
      }
    } catch (error) {
      console.error("[Webhook] ⚠️ Failed to grant membership perks:", error)
      // Don't fail the webhook if perks fail - membership is more important
    }
    
    // Return success for webhook logging
    return { 
      success: true, 
      studentId, 
      planId: finalPlanId, 
      paymentAmount, 
      subscriptionId: finalSubscriptionId, 
      membershipRecordId: existingMembership.length > 0 ? existingMembership[0].id : (verifyMembership.length > 0 ? verifyMembership[0].id : 'failed'),
      verified: verifyMembership.length > 0 && verifyStudent.length > 0 && verifyStudent[0].membership_tier === finalPlanId
    }
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string

  // Find student by Stripe customer ID
  const students = await sql`
    SELECT id FROM students WHERE stripe_customer_id = ${customerId}
  `

  if (students.length === 0) {
    console.error("Student not found for customer:", customerId)
    return
  }

  const studentId = students[0].id

  // Get the plan/tier from subscription metadata or price
  // Import STRIPE_PRODUCTS to check price IDs
  const { STRIPE_PRODUCTS } = await import("@/lib/stripe")
  const priceId = subscription.items.data[0]?.price.id
  let planId = subscription.metadata?.planId
  
  if (!planId && priceId) {
    // Determine plan from price ID
    if (priceId === STRIPE_PRODUCTS.Explorer) {
      planId = 'Explorer'
    } else if (priceId === STRIPE_PRODUCTS.Trailblazer) {
      planId = 'Trailblazer'
    } else {
      planId = 'Scholar'
    }
  }
  
  if (!planId) planId = 'Scholar' // Default fallback

  // When subscription is inactive (canceled, past_due, unpaid, etc.), downgrade to Scholar
  // unless the customer has OTHER active subscriptions
  const inactiveStatuses = ['canceled', 'past_due', 'unpaid', 'incomplete_expired', 'incomplete'] as const
  if (inactiveStatuses.includes(subscription.status as typeof inactiveStatuses[number])) {
    const otherSubs = await stripe.subscriptions.list({
      customer: customerId,
      status: 'active',
      limit: 10,
    })
    const remainingActive = otherSubs.data.filter((s) => s.id !== subscription.id)
    if (remainingActive.length > 0) {
      // Customer has other active subscription(s) - update to use the remaining one
      const remainingSub = remainingActive[0]
      const priceId = remainingSub.items.data[0]?.price.id
      let tier = 'Scholar'
      if (priceId === STRIPE_PRODUCTS.Trailblazer) tier = 'Trailblazer'
      else if (priceId === STRIPE_PRODUCTS.Explorer) tier = 'Explorer'
      await sql`
        UPDATE students
        SET membership_tier = ${tier}, stripe_subscription_id = ${remainingSub.id}
        WHERE id = ${studentId}
      `
      const remainingExpiresAt = remainingSub.cancel_at ?? remainingSub.current_period_end
      await sql`
        UPDATE memberships
        SET tier = ${tier}, plan = ${tier}, status = 'active',
            stripe_subscription_id = ${remainingSub.id},
            expires_at = to_timestamp(${remainingExpiresAt}),
            end_date = to_timestamp(${remainingExpiresAt}),
            auto_renew = false,
            updated_at = CURRENT_TIMESTAMP
        WHERE student_id = ${studentId}
      `
      try {
        await grantPerksReliable(studentId, tier as MembershipTier)
      } catch (err) {
        console.error("[Webhook] Failed to grant perks after switching to remaining sub:", err)
      }
      console.log(`[Webhook] Subscription ${subscription.id} inactive; kept remaining ${remainingSub.id}, tier ${tier}`)
      return
    }
    // No other active subscriptions - downgrade to Scholar
    await sql`
      UPDATE students
      SET membership_tier = 'Scholar', stripe_subscription_id = NULL
      WHERE id = ${studentId}
    `
    await sql`
      UPDATE memberships
      SET status = 'canceled', tier = 'Scholar', plan = 'Scholar',
          auto_renew = false, updated_at = CURRENT_TIMESTAMP
      WHERE student_id = ${studentId} AND stripe_subscription_id = ${subscription.id}
    `
    try {
      await grantPerksReliable(studentId, "Scholar")
      console.log(`[Webhook] Downgraded student ${studentId} to Scholar (subscription ${subscription.status})`)
    } catch (err) {
      console.error("[Webhook] Failed to grant Scholar perks after downgrade:", err)
    }
    return
  }

  // If subscription is active, ensure student has the correct tier
  // Check if there are multiple active subscriptions and use the highest tier
  if (subscription.status === 'active' || subscription.status === 'trialing') {
    // Get all active subscriptions for this customer
    const allSubscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'all',
      limit: 100
    })
    
    const activeSubs = allSubscriptions.data.filter(sub => 
      sub.status === 'active' || sub.status === 'trialing'
    )
    
    // Determine highest tier from all active subscriptions
    let highestTier = planId
    for (const sub of activeSubs) {
      const subPriceId = sub.items.data[0]?.price.id
      if (subPriceId === STRIPE_PRODUCTS.Trailblazer) {
        highestTier = 'Trailblazer'
        break // Trailblazer is highest, no need to check further
      } else if (subPriceId === STRIPE_PRODUCTS.Explorer && highestTier !== 'Trailblazer') {
        highestTier = 'Explorer'
      }
    }
    
    planId = highestTier
    console.log(`[Webhook] Multiple subscriptions detected. Using highest tier: ${planId}`)
  }

  // Use cancel_at for expires_at when set (monthly subs end at semester); else current_period_end
  const expiresAtTimestamp = subscription.cancel_at ?? subscription.current_period_end

  // Update membership status - update all memberships for this student to ensure consistency
  await sql`
    UPDATE memberships
    SET 
      tier = ${planId},
      plan = ${planId},
      status = ${subscription.status},
      expires_at = to_timestamp(${expiresAtTimestamp}),
      end_date = to_timestamp(${expiresAtTimestamp}),
      auto_renew = false,
      updated_at = CURRENT_TIMESTAMP
    WHERE student_id = ${studentId} AND stripe_subscription_id = ${subscription.id}
  `

  // Also update students.membership_tier to match the highest active tier
  await sql`
    UPDATE students
    SET 
      membership_tier = ${planId},
      stripe_subscription_id = ${subscription.id}
    WHERE id = ${studentId}
  `

  // Grant perks if subscription is active and tier changed
  if (subscription.status === 'active' || subscription.status === 'trialing') {
    try {
      await grantPerksReliable(studentId, planId as MembershipTier)
      console.log(`[Webhook] ✅ Granted all perks for ${planId} tier after subscription update`)
      
      // Verify retake access for Explorer/Trailblazer members
      if (planId === "Explorer" || planId === "Trailblazer") {
        const { hasRetakeAccess } = await import("@/lib/retake-access")
        const retakeAccess = await hasRetakeAccess(studentId)
        console.log(`[Webhook] ✅ Verified retake access for ${planId}: ${retakeAccess ? "GRANTED" : "NOT GRANTED"}`)
        if (!retakeAccess) {
          console.error(`[Webhook] ⚠️ WARNING: ${planId} member should have retake access but check returned false`)
        }
      }
    } catch (error) {
      console.error("[Webhook] Failed to grant perks after subscription update:", error)
    }
  }

  console.log(`Subscription updated for student ${studentId} to tier ${planId}`)
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string

  const students = await sql`
    SELECT id FROM students WHERE stripe_customer_id = ${customerId}
  `

  if (students.length === 0) {
    console.error("[Webhook] Student not found for customer:", customerId)
    return
  }

  const studentId = students[0].id

  console.log(`[Webhook] Processing subscription deletion for student ${studentId}, subscription ${subscription.id}`)

  // Check if customer has OTHER active subscriptions (e.g. canceled one duplicate, keep the other)
  const otherSubs = await stripe.subscriptions.list({
    customer: customerId,
    status: "active",
    limit: 10,
  })

  const remainingActive = otherSubs.data.filter((s) => s.id !== subscription.id)

  if (remainingActive.length > 0) {
    // Customer still has active subscription(s) - update to use the remaining one, don't downgrade
    const remainingSub = remainingActive[0]
    const { STRIPE_PRODUCTS } = await import("@/lib/stripe")
    const priceId = remainingSub.items.data[0]?.price.id
    let tier = "Scholar"
    if (priceId === STRIPE_PRODUCTS.Trailblazer) tier = "Trailblazer"
    else if (priceId === STRIPE_PRODUCTS.Explorer) tier = "Explorer"

    await sql`
      UPDATE students
      SET membership_tier = ${tier}, stripe_subscription_id = ${remainingSub.id}
      WHERE id = ${studentId}
    `

    await sql`
      UPDATE memberships
      SET
        tier = ${tier},
        plan = ${tier},
        status = 'active',
        stripe_subscription_id = ${remainingSub.id},
        expires_at = to_timestamp(${remainingSub.current_period_end}),
        end_date = to_timestamp(${remainingSub.current_period_end}),
        auto_renew = ${!remainingSub.cancel_at_period_end},
        updated_at = CURRENT_TIMESTAMP
      WHERE student_id = ${studentId}
    `

    console.log(`[Webhook] Kept remaining subscription ${remainingSub.id}, tier ${tier}`)
    return
  }

  // No other active subscriptions - downgrade to Scholar
  await sql`
    UPDATE students
    SET
      membership_tier = 'Scholar',
      stripe_subscription_id = NULL
    WHERE id = ${studentId}
  `

  await sql`
    UPDATE memberships
    SET
      status = 'canceled',
      tier = 'Scholar',
      plan = 'Scholar',
      auto_renew = false,
      updated_at = CURRENT_TIMESTAMP
    WHERE student_id = ${studentId} AND stripe_subscription_id = ${subscription.id}
  `

  try {
    await grantPerksReliable(studentId, "Scholar")
    console.log(`[Webhook] Granted Scholar perks after subscription cancellation`)
  } catch (error) {
    console.error("[Webhook] Failed to grant Scholar perks after cancellation:", error)
  }

  console.log(`[Webhook] Subscription canceled and student ${studentId} downgraded to Scholar`)
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string
  const subscriptionId = invoice.subscription as string

  const students = await sql`
    SELECT id FROM students WHERE stripe_customer_id = ${customerId}
  `

  if (students.length === 0) {
    console.log(`[Webhook] No student found for customer ${customerId}`)
    return
  }

  const studentId = students[0].id

  // Record payment
  try {
    await sql`
      INSERT INTO payments (student_id, amount, status, stripe_invoice_id, stripe_checkout_session_id, created_at)
      VALUES (
        ${studentId},
        ${invoice.amount_paid / 100},
        'succeeded',
        ${invoice.id},
        ${null},
        NOW()
      )
      ON CONFLICT (stripe_invoice_id) DO UPDATE SET
        amount = ${invoice.amount_paid / 100},
        status = 'succeeded'
    `
    console.log(`[Webhook] ✅ Payment recorded for student ${studentId}: $${invoice.amount_paid / 100}`)
  } catch (error: any) {
    // Payments table might not exist or have different structure
    console.log(`[Webhook] Could not record payment: ${error.message}`)
  }

  // If this is a subscription payment, update membership expiration (use cancel_at or semester end)
  if (subscriptionId) {
    try {
      // Get subscription to determine tier and expiration
      const subscription = await stripe.subscriptions.retrieve(subscriptionId)
      const priceId = subscription.items.data[0]?.price.id
      
      let tier = 'Scholar'
      const { STRIPE_PRODUCTS } = await import("@/lib/stripe")
      if (priceId === STRIPE_PRODUCTS.Trailblazer) {
        tier = 'Trailblazer'
      } else if (priceId === STRIPE_PRODUCTS.Explorer) {
        tier = 'Explorer'
      }

      // Use cancel_at (semester end) when set; else set it and use semester end
      let expiresAtTimestamp = subscription.cancel_at
      if (!expiresAtTimestamp) {
        const semesterEnd = await getSemesterEndDate()
        expiresAtTimestamp = Math.floor(semesterEnd.getTime() / 1000)
        try {
          await stripe.subscriptions.update(subscriptionId, { cancel_at: expiresAtTimestamp })
        } catch (e) {
          console.warn("[Webhook] Failed to set cancel_at on subscription:", (e as Error)?.message)
        }
      }
      const expiresAt = new Date(expiresAtTimestamp * 1000).toISOString()

      // Update membership expiration date
      await sql`
        UPDATE memberships
        SET
          expires_at = ${expiresAt}::timestamp,
          end_date = ${expiresAt}::timestamp,
          status = 'active',
          auto_renew = false,
          updated_at = NOW()
        WHERE student_id = ${studentId}
          AND stripe_subscription_id = ${subscriptionId}
      `

      // Also update student tier to ensure it matches
      await sql`
        UPDATE students
        SET membership_tier = ${tier}
        WHERE id = ${studentId}
      `

      // Update or create membership record to ensure consistency
      const existingMembership = await sql`
        SELECT id FROM memberships 
        WHERE student_id = ${studentId} 
          AND (deleted_at IS NULL OR deleted_at IS NOT NULL)
      `

      if (existingMembership.length > 0) {
        await sql`
          UPDATE memberships
          SET
            tier = ${tier},
            plan = ${tier},
            status = 'active',
            expires_at = ${expiresAt}::timestamp,
            end_date = ${expiresAt}::timestamp,
            auto_renew = false,
            updated_at = NOW(),
            deleted_at = NULL
          WHERE student_id = ${studentId}
        `
      } else {
        // Create membership if it doesn't exist
        const student = await sql`
          SELECT stripe_customer_id FROM students WHERE id = ${studentId} LIMIT 1
        `
        await sql`
          INSERT INTO memberships (
            student_id, tier, plan, stripe_customer_id, stripe_subscription_id, 
            status, expires_at, end_date, auto_renew, start_date
          )
          VALUES (
            ${studentId},
            ${tier},
            ${tier},
            ${student[0]?.stripe_customer_id || null},
            ${subscriptionId},
            'active',
            ${expiresAt}::timestamp,
            ${expiresAt}::timestamp,
            false,
            NOW()
          )
        `
      }

      // Grant perks for all tiers (Explorer and Trailblazer get retake access)
      if (tier === 'Explorer' || tier === 'Trailblazer') {
        try {
          await grantPerksReliable(studentId, tier as MembershipTier)
          console.log(`[Webhook] ✅ Granted all perks for ${tier} tier (including retake access)`)
          
          // Verify retake access is working
          const { hasRetakeAccess } = await import("@/lib/retake-access")
          const retakeAccess = await hasRetakeAccess(studentId)
          console.log(`[Webhook] ✅ Verified retake access for ${tier}: ${retakeAccess ? "GRANTED" : "NOT GRANTED"}`)
          if (!retakeAccess) {
            console.error(`[Webhook] ⚠️ WARNING: ${tier} member should have retake access but check returned false`)
          }
        } catch (perkError) {
          console.error("[Webhook] ⚠️ Failed to grant perks:", perkError)
        }
      }

      // Verify the update
      const verifyUpdate = await sql`
        SELECT membership_tier FROM students WHERE id = ${studentId} LIMIT 1
      `
      
      if (verifyUpdate.length > 0 && verifyUpdate[0].membership_tier !== tier) {
        console.error(`[Webhook] ❌ CRITICAL: Student tier not updated correctly. Expected: ${tier}, Got: ${verifyUpdate[0].membership_tier}`)
        // Retry once
        await sql`
          UPDATE students
          SET membership_tier = ${tier}
          WHERE id = ${studentId}
        `
      }

      console.log(`[Webhook] ✅ Extended membership for student ${studentId} (${tier}) - new expiration: ${new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()}`)
    } catch (error: any) {
      console.error(`[Webhook] Failed to extend membership for student ${studentId}:`, error)
    }
  }
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string

  const students = await sql`
    SELECT id, full_name, membership_tier FROM students WHERE stripe_customer_id = ${customerId}
  `

  if (students.length === 0) return

  const studentId = students[0].id
  const wasPremium = ["Explorer", "Trailblazer"].includes(students[0].membership_tier || "")

  // Record failed payment (payments table may not exist)
  try {
    const paymentsCheck = await sql`
      SELECT 1 FROM information_schema.tables WHERE table_name = 'payments' LIMIT 1
    `
    if (paymentsCheck.length > 0) {
      await sql`
        INSERT INTO payments (student_id, amount, status, stripe_invoice_id)
        VALUES (
          ${studentId},
          ${invoice.amount_due / 100},
          'failed',
          ${invoice.id}
        )
      `
    }
  } catch (e) {
    // Ignore - payments table might not exist or have different schema
  }

  // Revoke membership perks: downgrade to Scholar and grant Scholar perks
  if (wasPremium) {
    await sql`
      UPDATE students
      SET membership_tier = 'Scholar'
      WHERE id = ${studentId}
    `

    await sql`
      UPDATE memberships
      SET tier = 'Scholar', plan = 'Scholar', updated_at = CURRENT_TIMESTAMP
      WHERE student_id = ${studentId}
    `

    try {
      await grantPerksReliable(studentId, "Scholar")
      console.log(`[Webhook] ✅ Revoked premium perks for student ${studentId} after payment failure`)
    } catch (perkError) {
      console.error("[Webhook] Failed to revoke perks:", perkError)
    }
  }

  // Notify student that their membership needs attention
  try {
    const { createNotification } = await import("@/lib/create-notification")
    await createNotification({
      studentId,
      type: "membership",
      title: "Membership Payment Failed",
      message:
        "Your membership payment could not be processed. Please update your payment method to restore access to premium features.",
      link: "/student/membership/manage",
    })
    console.log(`[Webhook] ✅ Notification sent to student ${studentId} about payment failure`)
  } catch (notifError) {
    console.error("[Webhook] Failed to create notification:", notifError)
  }

  console.log(`[Webhook] Payment failed for student ${studentId} - perks revoked, notification sent`)
}

async function handleMembershipPaymentFailed(session: Stripe.Checkout.Session, errorMessage: string) {
  const studentId = session.metadata?.studentId
  if (!studentId) return

  try {
    const { createNotification } = await import("@/lib/create-notification")
    await createNotification({
      studentId: parseInt(studentId),
      type: "membership",
      title: "Membership Payment Failed",
      message: `Your membership payment could not be processed. ${errorMessage}. Please update your payment method and try again.`,
      link: "/student/membership/manage",
    })
    console.log(`[Webhook] ✅ Notification sent to student ${studentId} about membership payment failure`)
  } catch (error) {
    console.error("[Webhook] Failed to create notification for membership payment failure:", error)
  }
}

async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  const studentId = paymentIntent.metadata?.studentId
  const planId = paymentIntent.metadata?.planId
  const billingCadence = paymentIntent.metadata?.billingCadence as "monthly" | "semester" | undefined
  const isSemester = billingCadence === "semester"

  console.log(`[Webhook] Processing payment_intent.succeeded for semester plan:`, {
    paymentIntentId: paymentIntent.id,
    studentId,
    planId,
    billingCadence,
    amount: paymentIntent.amount / 100
  })

  if (!studentId || !isPaidMembershipTier(planId)) {
    console.error(`[Webhook] Missing metadata in payment intent ${paymentIntent.id}`)
    return
  }

  if (
    !isAuthorizedStudentMembershipCharge(
      planId,
      isSemester ? "semester" : "monthly",
      paymentIntent.amount_received || paymentIntent.amount,
    )
  ) {
    console.error("[Webhook] Refusing PI membership grant: amount does not match catalog", {
      paymentIntentId: paymentIntent.id,
      planId,
      amount: paymentIntent.amount_received || paymentIntent.amount,
    })
    return
  }

  // For semester plans, process similar to checkout.session.completed
  // This ensures immediate access even if checkout.session.completed webhook is delayed
  const customerId = paymentIntent.customer as string

  // Update student membership tier
  await sql`
    UPDATE students
    SET 
      membership_tier = ${planId},
      stripe_customer_id = ${customerId || null}
    WHERE id = ${Number.parseInt(studentId)}
  `

  // Calculate expiration date for semester
  const semesterEndDate = await getSemesterEndDate()
  const expiresAt = isSemester 
    ? semesterEndDate.toISOString()
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  const autoRenew = !isSemester

  // Update or create membership
  const existingMembership = await sql`
    SELECT id FROM memberships 
    WHERE student_id = ${Number.parseInt(studentId)}
      AND (deleted_at IS NULL OR deleted_at IS NOT NULL)
    LIMIT 1
  `

  if (existingMembership.length > 0) {
    await sql`
      UPDATE memberships
      SET
        tier = ${planId},
        plan = ${planId},
        stripe_customer_id = ${customerId || null},
        billing_cadence = ${billingCadence || 'monthly'},
        status = 'active',
        expires_at = ${expiresAt}::timestamp,
        end_date = ${expiresAt}::timestamp,
        auto_renew = ${autoRenew},
        updated_at = CURRENT_TIMESTAMP,
        deleted_at = NULL
      WHERE student_id = ${Number.parseInt(studentId)}
    `
  } else {
    await sql`
      INSERT INTO memberships (
        student_id, tier, plan, stripe_customer_id, billing_cadence, 
        status, expires_at, end_date, auto_renew, start_date
      )
      VALUES (
        ${Number.parseInt(studentId)},
        ${planId},
        ${planId},
        ${customerId || null},
        ${billingCadence || 'monthly'},
        'active',
        ${expiresAt}::timestamp,
        ${expiresAt}::timestamp,
        ${autoRenew},
        NOW()
      )
    `
  }

  // Grant all perks for the tier
  try {
    await grantPerksReliable(parseInt(studentId), planId as MembershipTier)
    console.log(`[Webhook] ✅ Granted all perks for ${planId} tier (from payment_intent.succeeded)`)
  } catch (error) {
    console.error("[Webhook] ⚠️ Failed to grant membership perks:", error)
  }

  // Send payment success email
  try {
    const amount = (paymentIntent.amount / 100).toFixed(2)
    const studentRow = await sql`SELECT full_name, email FROM students WHERE id = ${Number.parseInt(studentId)} LIMIT 1`
    if (studentRow[0]?.email && !String(studentRow[0].email).endsWith("@student.placeholder.edu")) {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://course-collab.com"
      const { sendEmail } = await import("@/lib/email/sendEmail")
      await sendEmail("payment_success", studentRow[0].email as string, {
        name: (studentRow[0].full_name as string) || "Student",
        amount,
        description: `${planId} membership (${billingCadence === "semester" ? "Semester" : "Monthly"})`,
        link: `${baseUrl}/student/membership`,
      })
    }
  } catch (emailErr) {
    console.warn("[Webhook] Payment success email failed:", emailErr)
  }

  console.log(`[Webhook] ✅ Processed payment_intent.succeeded for student ${studentId}: ${planId} (${billingCadence || 'monthly'})`)
}

async function handleDonationCompleted(session: Stripe.Checkout.Session) {
  const studentId = session.metadata?.studentId
  const donationId = session.metadata?.donationId
  const amount = session.amount_total ? (session.amount_total / 100) : parseFloat(session.metadata?.amount || "0")

  if (!studentId) {
    console.error("[Webhook] Missing studentId in donation session")
    return
  }

  await ensureDonationsSchema()

  console.log(`[Webhook] Processing donation completion for student ${studentId}, amount: $${amount}`)

  // Get the actual payment amount and payment method from Stripe session
  const sessionDetails = await stripe.checkout.sessions.retrieve(session.id, {
    expand: ['line_items', 'payment_intent', 'payment_intent.latest_charge']
  })
  
  const actualAmount = sessionDetails.amount_total ? (sessionDetails.amount_total / 100) : amount
  
  // Extract payment method from session
  let paymentMethod = 'stripe' // Default
  try {
    // First, check payment_method_types from session (what was available)
    if (sessionDetails.payment_method_types && sessionDetails.payment_method_types.length > 0) {
      // This tells us what payment methods were enabled, but not which one was used
      console.log(`[Webhook] Session payment_method_types:`, sessionDetails.payment_method_types)
    }

    // Get payment method from payment intent -> latest charge -> payment method details
    if (sessionDetails.payment_intent) {
      const paymentIntent = typeof sessionDetails.payment_intent === 'string' 
        ? await stripe.paymentIntents.retrieve(sessionDetails.payment_intent, {
            expand: ['latest_charge']
          })
        : sessionDetails.payment_intent
      
      console.log(`[Webhook] Payment intent retrieved:`, {
        id: paymentIntent.id,
        status: paymentIntent.status,
        hasLatestCharge: !!paymentIntent.latest_charge
      })

      // Try to get payment method from latest charge (most reliable)
      if (paymentIntent.latest_charge) {
        const charge = typeof paymentIntent.latest_charge === 'string'
          ? await stripe.charges.retrieve(paymentIntent.latest_charge)
          : paymentIntent.latest_charge
        
        console.log(`[Webhook] Charge retrieved:`, {
          id: charge.id,
          payment_method_details: charge.payment_method_details ? Object.keys(charge.payment_method_details) : null,
          payment_method_details_type: charge.payment_method_details?.type,
          card_wallet: charge.payment_method_details?.card?.wallet?.type
        })

        // Check payment method details from charge
        if (charge.payment_method_details) {
          const pmDetails = charge.payment_method_details
          
          if (pmDetails.type === 'card') {
            const cardDetails = pmDetails.card
            if (cardDetails?.wallet?.type === 'apple_pay') {
              paymentMethod = 'apple_pay'
              console.log(`[Webhook] ✅ Detected Apple Pay from charge`)
            } else if (cardDetails?.wallet?.type === 'google_pay') {
              paymentMethod = 'google_pay'
              console.log(`[Webhook] ✅ Detected Google Pay from charge`)
            } else {
              paymentMethod = 'stripe_card'
              console.log(`[Webhook] ✅ Detected regular card from charge`)
            }
          } else {
            paymentMethod = pmDetails.type || 'stripe'
            console.log(`[Webhook] ✅ Detected payment method type: ${pmDetails.type}`)
          }
        } else {
          console.log(`[Webhook] ⚠️ Charge has no payment_method_details`)
        }
      } else {
        console.log(`[Webhook] ⚠️ Payment intent has no latest_charge`)
      }
      
      // Fallback: try to get payment method directly from payment intent
      if (paymentMethod === 'stripe' && paymentIntent.payment_method) {
        const pm = typeof paymentIntent.payment_method === 'string'
          ? await stripe.paymentMethods.retrieve(paymentIntent.payment_method)
          : paymentIntent.payment_method
        
        console.log(`[Webhook] Payment method retrieved:`, {
          id: pm.id,
          type: pm.type,
          card_wallet: pm.card?.wallet?.type
        })
        
        // Determine payment method type
        if (pm.type === 'card') {
          if (pm.card?.wallet?.type === 'apple_pay') {
            paymentMethod = 'apple_pay'
          } else if (pm.card?.wallet?.type === 'google_pay') {
            paymentMethod = 'google_pay'
          } else {
            paymentMethod = 'stripe_card'
          }
        } else {
          paymentMethod = pm.type || 'stripe'
        }
      }
    }
    
    console.log(`[Webhook] Determined payment method: ${paymentMethod}`)
  } catch (error) {
    console.error("[Webhook] Failed to retrieve payment method:", error)
    console.error("[Webhook] Error details:", {
      message: (error as any)?.message,
      type: (error as any)?.type,
      code: (error as any)?.code
    })
    
    // Fallback: check payment_method_types from session
    if (paymentMethod === 'stripe' && sessionDetails.payment_method_types) {
      if (sessionDetails.payment_method_types.includes('card')) {
        paymentMethod = 'stripe_card' // At least we know it's a card
        console.log(`[Webhook] Using fallback: stripe_card (from payment_method_types)`)
      }
    }
    
    // Final fallback: if still 'stripe', default to 'stripe_card' since donations use card payments
    if (paymentMethod === 'stripe') {
      paymentMethod = 'stripe_card'
      console.log(`[Webhook] Final fallback: stripe_card (default for card payments)`)
    }
    
    console.log(`[Webhook] Final payment method after error handling: ${paymentMethod}`)
  }
  
  // Ensure we always have a payment method value (never null or 'stripe')
  // Since donations use card payments, default to 'stripe_card' if we couldn't determine
  if (!paymentMethod || paymentMethod === 'stripe') {
    paymentMethod = 'stripe_card'
    console.log(`[Webhook] Ensuring payment method is set (defaulting to stripe_card): ${paymentMethod}`)
  }
  
  console.log(`[Webhook] ✅ Final payment method to save: ${paymentMethod}`)

  // Check if deleted_at, error_message, and failed_at columns exist
  let hasDeletedAtColumn = false
  let hasErrorMessageColumn = false
  let hasFailedAtColumn = false
  try {
    const columnCheck = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'donations' AND column_name IN ('deleted_at', 'error_message', 'failed_at')
    `
    hasDeletedAtColumn = columnCheck.some((col: any) => col.column_name === 'deleted_at')
    hasErrorMessageColumn = columnCheck.some((col: any) => col.column_name === 'error_message')
    hasFailedAtColumn = columnCheck.some((col: any) => col.column_name === 'failed_at')
  } catch (e) {
    // Ignore - assume columns don't exist
  }

  // Update donation status to completed with actual amount
  // First try by donationId if provided
  let donationUpdated = false
  
  if (donationId) {
    try {
      // Update donation by ID - conditionally include error_message and failed_at if columns exist
      let updateResult
      if (hasDeletedAtColumn && hasErrorMessageColumn && hasFailedAtColumn) {
        updateResult = await sql`
          UPDATE donations
          SET 
            status = 'completed', 
            transaction_id = ${session.id},
            amount = ${actualAmount},
            payment_method = ${paymentMethod},
            error_message = NULL,
            failed_at = NULL,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ${parseInt(donationId)}
            AND deleted_at IS NULL
          RETURNING id
        `
      } else if (hasDeletedAtColumn) {
        updateResult = await sql`
          UPDATE donations
          SET 
            status = 'completed', 
            transaction_id = ${session.id},
            amount = ${actualAmount},
            payment_method = ${paymentMethod},
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ${parseInt(donationId)}
            AND deleted_at IS NULL
          RETURNING id
        `
      } else if (hasErrorMessageColumn && hasFailedAtColumn) {
        updateResult = await sql`
          UPDATE donations
          SET 
            status = 'completed', 
            transaction_id = ${session.id},
            amount = ${actualAmount},
            payment_method = ${paymentMethod},
            error_message = NULL,
            failed_at = NULL,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ${parseInt(donationId)}
          RETURNING id
        `
      } else {
        updateResult = await sql`
          UPDATE donations
          SET 
            status = 'completed', 
            transaction_id = ${session.id},
            amount = ${actualAmount},
            payment_method = ${paymentMethod},
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ${parseInt(donationId)}
          RETURNING id
        `
      }
      if (updateResult && updateResult.length > 0) {
        donationUpdated = true
        console.log(`[Webhook] Updated donation ${donationId} with amount $${actualAmount}`)
      }
    } catch (error) {
      console.error("[Webhook] Failed to update donation by ID:", error)
    }
  }
  
  // If not updated by donationId, try to find and update by transaction_id (session.id) and studentId
  // This handles cases where the donation record was created before metadata was updated
  if (!donationUpdated) {
    try {
      console.log(`[Webhook] DonationId not found, searching for pending donation by transaction_id: ${session.id}`)
      
      // Update by transaction_id OR by student_id + pending status - conditionally include error_message and failed_at
      let updateResult
      if (hasDeletedAtColumn && hasErrorMessageColumn && hasFailedAtColumn) {
        updateResult = await sql`
          UPDATE donations
          SET 
            status = 'completed', 
            transaction_id = ${session.id},
            amount = ${actualAmount},
            payment_method = ${paymentMethod},
            error_message = NULL,
            failed_at = NULL,
            updated_at = CURRENT_TIMESTAMP
          WHERE student_id = ${parseInt(studentId)}
            AND (
              transaction_id = ${session.id}
              OR (status = 'pending' AND created_at >= NOW() - INTERVAL '1 hour')
            )
            AND deleted_at IS NULL
            AND status != 'completed'
          ORDER BY created_at DESC
          LIMIT 1
          RETURNING id
        `
      } else if (hasDeletedAtColumn) {
        updateResult = await sql`
          UPDATE donations
          SET 
            status = 'completed', 
            transaction_id = ${session.id},
            amount = ${actualAmount},
            payment_method = ${paymentMethod},
            updated_at = CURRENT_TIMESTAMP
          WHERE student_id = ${parseInt(studentId)}
            AND (
              transaction_id = ${session.id}
              OR (status = 'pending' AND created_at >= NOW() - INTERVAL '1 hour')
            )
            AND deleted_at IS NULL
            AND status != 'completed'
          ORDER BY created_at DESC
          LIMIT 1
          RETURNING id
        `
      } else if (hasErrorMessageColumn && hasFailedAtColumn) {
        updateResult = await sql`
          UPDATE donations
          SET 
            status = 'completed', 
            transaction_id = ${session.id},
            amount = ${actualAmount},
            payment_method = ${paymentMethod},
            error_message = NULL,
            failed_at = NULL,
            updated_at = CURRENT_TIMESTAMP
          WHERE student_id = ${parseInt(studentId)}
            AND (
              transaction_id = ${session.id}
              OR (status = 'pending' AND created_at >= NOW() - INTERVAL '1 hour')
            )
            AND status != 'completed'
          ORDER BY created_at DESC
          LIMIT 1
          RETURNING id
        `
      } else {
        updateResult = await sql`
          UPDATE donations
          SET 
            status = 'completed', 
            transaction_id = ${session.id},
            amount = ${actualAmount},
            payment_method = ${paymentMethod},
            updated_at = CURRENT_TIMESTAMP
          WHERE student_id = ${parseInt(studentId)}
            AND (
              transaction_id = ${session.id}
              OR (status = 'pending' AND created_at >= NOW() - INTERVAL '1 hour')
            )
            AND status != 'completed'
          ORDER BY created_at DESC
          LIMIT 1
          RETURNING id
        `
      }
      if (updateResult && updateResult.length > 0) {
        donationUpdated = true
        console.log(`[Webhook] Updated donation by transaction_id: ${session.id}, amount: $${actualAmount}`)
        console.log(`[Webhook] Updated donation IDs:`, updateResult.map((r: any) => r.id))
      }
    } catch (error) {
      console.error("[Webhook] Failed to update donation by transaction_id:", error)
    }
  }
  
  // If still not updated, create new donation record
  if (!donationUpdated) {
    console.log(`[Webhook] No existing donation found, creating new donation record for student ${studentId}`)
    try {
      await sql`
        INSERT INTO donations (
          student_id,
          amount,
          donor_name,
          donor_email,
          status,
          transaction_id,
          is_anonymous,
          message,
          payment_method
        )
        VALUES (
          ${parseInt(studentId)},
          ${actualAmount},
          ${session.metadata?.donorName || 'Anonymous'},
          ${session.metadata?.email || null},
          'completed',
          ${session.id},
          ${session.metadata?.donorName === 'Anonymous'},
          ${session.metadata?.message || null},
          ${paymentMethod}
        )
      `
      console.log(`[Webhook] Created donation record for student ${studentId} with amount $${actualAmount}`)
      console.log(`[Webhook] Donation record details:`, {
        studentId: parseInt(studentId),
        amount: actualAmount,
        donorName: session.metadata?.donorName || 'Anonymous',
        status: 'completed',
        transactionId: session.id
      })
    } catch (error) {
      console.error("[Webhook] Failed to create donation record:", error)
      console.error("[Webhook] Error details:", {
        message: (error as any)?.message,
        code: (error as any)?.code,
        detail: (error as any)?.detail
      })
    }
  }

  // Add Supporter badge to student achievements (if table exists)
  try {
    const tableCheck = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'student_achievements'
    `
    
    if (tableCheck.length > 0) {
      await sql`
        INSERT INTO student_achievements (
          student_id, badge_type, badge_name, badge_icon, badge_color
        )
        VALUES (
          ${parseInt(studentId)},
          'supporter',
          'Supporter',
          '💜',
          '#9333ea'
        )
        ON CONFLICT (student_id, badge_type)
        DO NOTHING
      `
      console.log(`[Webhook] ✅ Added Supporter badge to student ${studentId}`)
    } else {
      console.log(`[Webhook] ℹ️  student_achievements table not found, skipping badge`)
    }
  } catch (error) {
    console.error("[Webhook] Failed to add supporter badge:", error)
    // Don't fail the whole process if badge addition fails
  }

  // Donation grants 14-day access to Trailblazer perks (but NOT a membership)
  // The donation record itself is sufficient - we check for donations within 14 days
  // This keeps revenue calculations accurate (donations vs memberships)
  console.log(`[Webhook] ✅ Donation completed for student ${studentId} - grants 14-day Trailblazer perks access`)
  console.log(`[Webhook] 📅 Access valid until: ${new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()}`)
  console.log(`[Webhook] 💡 Perks include: 2 retakes (3 total attempts), unlimited AI Tutor, unlimited Playground`)

  // Send payment success email for donation
  try {
    const { getStudentForEmail } = await import("@/lib/email/send-notification-email")
    const { sendEmail } = await import("@/lib/email/sendEmail")
    const student = await getStudentForEmail(parseInt(studentId))
    if (student?.email) {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://course-collab.com"
      sendEmail("payment_success", student.email, {
        name: student.name,
        amount: actualAmount.toFixed(2),
        description: "Donation - 14-day Trailblazer perks",
        link: `${baseUrl}/student/membership`,
      }).catch((e) => console.warn("[Webhook] Donation email error:", e))
    }
  } catch (e) {
    console.warn("[Webhook] Donation email error:", e)
  }

  // Grant all Trailblazer-level perks for donors (unlimited playground, unlimited AI tutor)
  try {
    const { grantDonationPerks } = await import("@/lib/membership")
    await grantDonationPerks(parseInt(studentId))
    console.log(`[Webhook] ✅ Successfully granted all Trailblazer perks to donor ${studentId}`)
  } catch (error) {
    console.error(`[Webhook] ❌ Failed to grant donation perks to student ${studentId}:`, error)
    // Don't fail the whole process if perk granting fails, but log it
  }

  // Legacy: Award 7 playground credits to donor (now handled by grantDonationPerks, but keeping for backwards compatibility)
  try {
    const { awardPlaygroundCredits } = await import("@/lib/membership")
    await awardPlaygroundCredits(
      parseInt(studentId),
      7,
      "donation",
      "7 playground credits from donation (legacy)"
    )
    console.log(`[Webhook] ✅ Successfully awarded 7 playground credits to donor ${studentId}`)
  } catch (error) {
    console.error("[Webhook] ⚠️  Failed to award playground credits (non-critical):", error)
    // Don't fail the whole process if credits fail - donation access is the main perk
  }

  // Verify donation access is immediately available
  try {
    const { hasActiveDonationTrial } = await import("@/lib/membership")
    const hasAccess = await hasActiveDonationTrial(parseInt(studentId))
    if (hasAccess) {
      console.log(`[Webhook] ✅ Verified: Student ${studentId} now has immediate donation access`)
    } else {
      console.error(`[Webhook] ⚠️  WARNING: Donation access check returned false immediately after completion!`)
      console.error(`[Webhook] This may indicate a timing or query issue`)
    }
  } catch (error) {
    console.error("[Webhook] ⚠️  Could not verify donation access (non-critical):", error)
  }
}

async function handleDonationFailed(session: Stripe.Checkout.Session, errorMessage: string) {
  const studentId = session.metadata?.studentId
  const donationId = session.metadata?.donationId

  if (!studentId) {
    console.error("[Webhook] Missing studentId in failed donation session")
    return
  }

  await ensureDonationsSchema()

  console.log(`[Webhook] Processing donation failure for student ${studentId}, error: ${errorMessage}`)

  // Create notification for the student about the failed payment
  try {
    const { createNotification } = await import("@/lib/create-notification")
    await createNotification({
      studentId: parseInt(studentId),
      type: "donation",
      title: "Payment Failed",
      message: `Your donation payment could not be processed. ${errorMessage}. Please try again or contact support if the issue persists.`,
      link: "/student/donate"
    })
    console.log(`[Webhook] ✅ Notification sent to student ${studentId} about failed payment`)
  } catch (error) {
    console.error("[Webhook] Failed to create notification for failed donation:", error)
    // Don't fail the whole process if notification fails
  }

  // Check if error_message and failed_at columns exist
  let hasErrorMessageColumn = false
  let hasFailedAtColumn = false
  let hasDeletedAtColumn = false
  try {
    const columnCheck = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'donations' AND column_name IN ('error_message', 'failed_at', 'deleted_at')
    `
    hasErrorMessageColumn = columnCheck.some((col: any) => col.column_name === 'error_message')
    hasFailedAtColumn = columnCheck.some((col: any) => col.column_name === 'failed_at')
    hasDeletedAtColumn = columnCheck.some((col: any) => col.column_name === 'deleted_at')
  } catch (e) {
    // Ignore - assume columns don't exist
  }

  // Update donation status to failed
  try {
    if (donationId) {
      // Update by donation ID
      if (hasDeletedAtColumn && hasErrorMessageColumn && hasFailedAtColumn) {
        await sql`
          UPDATE donations
          SET 
            status = 'failed',
            error_message = ${errorMessage},
            failed_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ${parseInt(donationId)}
            AND deleted_at IS NULL
        `
      } else if (hasDeletedAtColumn) {
        await sql`
          UPDATE donations
          SET 
            status = 'failed',
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ${parseInt(donationId)}
            AND deleted_at IS NULL
        `
      } else if (hasErrorMessageColumn && hasFailedAtColumn) {
        await sql`
          UPDATE donations
          SET 
            status = 'failed',
            error_message = ${errorMessage},
            failed_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ${parseInt(donationId)}
        `
      } else {
        await sql`
          UPDATE donations
          SET 
            status = 'failed',
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ${parseInt(donationId)}
        `
      }
      console.log(`[Webhook] Updated donation ${donationId} to failed status`)
    } else {
      // Update by transaction_id (session.id) and student_id
      if (hasDeletedAtColumn && hasErrorMessageColumn && hasFailedAtColumn) {
        await sql`
          UPDATE donations
          SET 
            status = 'failed',
            error_message = ${errorMessage},
            failed_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
          WHERE student_id = ${parseInt(studentId)}
            AND (
              transaction_id = ${session.id}
              OR (status = 'pending' AND created_at >= NOW() - INTERVAL '1 hour')
            )
            AND deleted_at IS NULL
            AND status != 'failed'
          ORDER BY created_at DESC
          LIMIT 1
        `
      } else if (hasDeletedAtColumn) {
        await sql`
          UPDATE donations
          SET 
            status = 'failed',
            updated_at = CURRENT_TIMESTAMP
          WHERE student_id = ${parseInt(studentId)}
            AND (
              transaction_id = ${session.id}
              OR (status = 'pending' AND created_at >= NOW() - INTERVAL '1 hour')
            )
            AND deleted_at IS NULL
            AND status != 'failed'
          ORDER BY created_at DESC
          LIMIT 1
        `
      } else if (hasErrorMessageColumn && hasFailedAtColumn) {
        await sql`
          UPDATE donations
          SET 
            status = 'failed',
            error_message = ${errorMessage},
            failed_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
          WHERE student_id = ${parseInt(studentId)}
            AND (
              transaction_id = ${session.id}
              OR (status = 'pending' AND created_at >= NOW() - INTERVAL '1 hour')
            )
            AND status != 'failed'
          ORDER BY created_at DESC
          LIMIT 1
        `
      } else {
        await sql`
          UPDATE donations
          SET 
            status = 'failed',
            updated_at = CURRENT_TIMESTAMP
          WHERE student_id = ${parseInt(studentId)}
            AND (
              transaction_id = ${session.id}
              OR (status = 'pending' AND created_at >= NOW() - INTERVAL '1 hour')
            )
            AND status != 'failed'
          ORDER BY created_at DESC
          LIMIT 1
        `
      }
      console.log(`[Webhook] Updated donation by transaction_id ${session.id} to failed status`)
    }
  } catch (error) {
    console.error("[Webhook] Failed to update donation to failed status:", error)
  }
}

async function handleGuestCareerLifetimeCheckout(session: Stripe.Checkout.Session) {
  const studentId = parseInt(String(session.metadata?.studentId ?? ""), 10)
  if (!Number.isFinite(studentId) || studentId <= 0) {
    console.error("[Webhook] guest career checkout missing studentId", session.id)
    return
  }
  const rawPlan = String(session.metadata?.plan ?? "cora_career")
  const plan =
    rawPlan === "cora_career_essentials" ? ("cora_career_essentials" as const) : ("cora_career" as const)
  const { fulfillGuestCareerPlanPurchase } = await import("@/lib/guest/fulfill-membership")
  const result = await fulfillGuestCareerPlanPurchase({
    stripeSessionId: session.id,
    studentId,
    plan,
    amountCents: session.amount_total ?? 0,
    currency: session.currency ?? "usd",
  })
  if (!result.ok) {
    console.error("[Webhook] guest career fulfill failed:", result.error, session.id)
    throw new Error(result.error ?? "Guest Cora Career fulfillment failed")
  }
  console.log(`[Webhook] guest career ${plan} fulfilled for guest ${studentId}`, {
    sessionId: session.id,
    alreadyFulfilled: result.alreadyFulfilled,
  })
}

/** @deprecated metadata type guest_career_pass */
async function handleGuestCareerPassCheckout(session: Stripe.Checkout.Session) {
  await handleGuestCareerLifetimeCheckout(session)
}

async function handleGuestCoraCreditPackCheckout(session: Stripe.Checkout.Session) {
  const studentId = parseInt(String(session.metadata?.studentId ?? ""), 10)
  const packId = String(session.metadata?.packId ?? "").trim()
  if (!Number.isFinite(studentId) || studentId <= 0 || !packId) {
    console.error("[Webhook] guest_cora_credit_pack missing studentId/packId", session.id, session.metadata)
    return
  }
  const { fulfillGuestCreditPackPurchase } = await import("@/lib/guest/fulfill-membership")
  const result = await fulfillGuestCreditPackPurchase({
    stripeSessionId: session.id,
    studentId,
    packId,
    amountCents: session.amount_total ?? 0,
    currency: session.currency ?? "usd",
  })
  if (!result.ok) {
    console.error("[Webhook] guest_cora_credit_pack fulfill failed:", result.error, session.id)
    throw new Error(result.error ?? "Guest credit pack fulfillment failed")
  }
  console.log(`[Webhook] guest_cora_credit_pack fulfilled for guest ${studentId}`, {
    sessionId: session.id,
    packId,
    alreadyFulfilled: result.alreadyFulfilled,
  })
}

