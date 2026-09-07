import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { stripe, STRIPE_PRODUCTS } from "@/lib/stripe"
import type { BillingCadence } from "@/lib/membership-constants"
import { studentSemesterLineItem } from "@/lib/stripe-student-semester-line-item"
import { getSemesterEndDate } from "@/lib/semester-utils"
import {
  isSemesterOnlyBillingStudent,
  resolveStudentBillingCadence,
} from "@/lib/student-billing-eligibility"
import { mobileStudentMembershipReturnUrls } from "@/lib/mobile-membership-return-urls"
import { requireStudentIdParamMatchesCaller } from "@/lib/student-api-auth"
import { checkRateLimit, PAYMENT_MUTATION_RATE_LIMIT, rateLimitKey } from "@/lib/compliance/rate-limit"

export const runtime = "nodejs"

export async function GET() {
  return NextResponse.json({ error: "Not found" }, { status: 404 })
}

export async function POST(request: NextRequest) {
  try {
    let body: Record<string, unknown>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }
    const limited = checkRateLimit(
      rateLimitKey(request, "membership-upgrade"),
      PAYMENT_MUTATION_RATE_LIMIT.limit,
      PAYMENT_MUTATION_RATE_LIMIT.windowMs,
    )
    if (!limited.ok) {
      return NextResponse.json({ error: "Too many payment requests" }, { status: 429 })
    }

    const { studentId, tier, billingCadence, redirectCheckout, mobileReturn } = body

    if (!studentId || !tier) {
      return NextResponse.json({ error: "Student ID and tier required" }, { status: 400 })
    }

    const auth = await requireStudentIdParamMatchesCaller(request, String(studentId))
    if (!auth.ok) return auth.response

    // Validate tier
    const validTiers = ["Scholar", "Explorer", "Trailblazer"]
    if (!validTiers.includes(tier)) {
      return NextResponse.json({ error: "Invalid tier" }, { status: 400 })
    }

    // Validate billing cadence if provided
    const studentBillingRows = await sql`
      SELECT COALESCE(is_platform_guest, false) AS is_platform_guest
      FROM students
      WHERE id = ${parseInt(String(studentId))}
      LIMIT 1
    `
    if (studentBillingRows.length === 0) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 })
    }
    const semesterOnlyBilling = isSemesterOnlyBillingStudent(
      studentBillingRows[0]?.is_platform_guest,
    )
    const cadence: BillingCadence = resolveStudentBillingCadence(
      String(tier),
      billingCadence === "semester" ? "semester" : billingCadence === "monthly" ? "monthly" : undefined,
      semesterOnlyBilling,
    )

    console.log("[Membership Upgrade] Processing upgrade:", { studentId, tier, cadence, semesterOnlyBilling })

    // For free tier (Scholar), update directly without Stripe
    if (tier === "Scholar") {
      console.log("[Membership Upgrade] Updating to free tier (Scholar)")
      
      // Update existing membership
      const existing = await sql`
        SELECT id FROM memberships WHERE student_id = ${parseInt(studentId)} LIMIT 1
      `

      let result
      if (existing.length > 0) {
        result = await sql`
          UPDATE memberships
          SET 
            tier = ${tier},
            plan = ${tier},
            status = 'active',
            expires_at = NULL,
            end_date = NULL,
            auto_renew = false,
            updated_at = CURRENT_TIMESTAMP
          WHERE student_id = ${parseInt(studentId)}
          RETURNING *
        `
      } else {
        result = await sql`
          INSERT INTO memberships (
            student_id, tier, plan, status, expires_at, end_date, auto_renew
          )
          VALUES (
            ${parseInt(studentId)}, 
            ${tier}, 
            ${tier},
            'active', 
            NULL,
            NULL,
            false
          )
          RETURNING *
        `
      }

      // Update students.membership_tier
      await sql`
        UPDATE students 
        SET membership_tier = ${tier}
        WHERE id = ${parseInt(studentId)}
      `

      // Grant perks for the new tier
      try {
        const { grantMembershipPerks } = await import("@/lib/membership")
        await grantMembershipPerks(parseInt(studentId), tier as any)
        console.log(`[Membership Upgrade] Granted perks for ${tier} tier`)
      } catch (error) {
        console.error("[Membership Upgrade] Failed to grant perks:", error)
        // Don't fail the upgrade if perks fail
      }

      return NextResponse.json({ 
        success: true, 
        membership: result[0],
        requiresPayment: false
      })
    }

    // For paid tiers, create Stripe checkout session
    if (!stripe) {
      console.error("[Membership Upgrade] Stripe not configured - STRIPE_SECRET_KEY may be missing in Vercel")
      return NextResponse.json({ 
        error: "Payment processing is not configured. Please contact support.",
        code: "STRIPE_NOT_CONFIGURED"
      }, { status: 503 })
    }

    // Get the correct price ID based on tier and billing cadence
    let priceId: string | undefined
    if (cadence === "semester") {
      if (tier === "Explorer") {
        priceId = STRIPE_PRODUCTS.Explorer_Semester
      } else if (tier === "Trailblazer") {
        priceId = STRIPE_PRODUCTS.Trailblazer_Semester
      }
    } else {
      // Monthly subscription
      priceId = STRIPE_PRODUCTS[tier as keyof typeof STRIPE_PRODUCTS]
    }

    console.log("[Membership Upgrade] Price ID lookup:", { 
      tier, 
      cadence, 
      priceId, 
      availableTiers: Object.keys(STRIPE_PRODUCTS),
      explorerSemester: STRIPE_PRODUCTS.Explorer_Semester,
      trailblazerSemester: STRIPE_PRODUCTS.Trailblazer_Semester,
      explorerMonthly: STRIPE_PRODUCTS.Explorer,
      trailblazerMonthly: STRIPE_PRODUCTS.Trailblazer
    })
    
    if (!priceId && cadence !== "semester") {
      console.error("[Membership Upgrade] No price ID found for tier:", tier, "cadence:", cadence)
      return NextResponse.json({ 
        error: "Invalid tier or billing cadence for payment processing",
        details: `No price ID configured for tier: ${tier}, cadence: ${cadence}. Available tiers: ${Object.keys(STRIPE_PRODUCTS).join(", ")}`
      }, { status: 400 })
    }
    
    // Note: Semester checkout can use catalog price_data when the configured Stripe price is stale.
    if (priceId && !priceId.startsWith("price_") && !priceId.startsWith("prod_")) {
      console.error("[Membership Upgrade] Invalid Stripe ID format:", { tier, cadence, priceId })
      return NextResponse.json({ 
        error: "Payment processing is not properly configured. Please contact support.",
        details: `Invalid Stripe ID format for tier: ${tier}, cadence: ${cadence}. Expected format: price_xxxxx or prod_xxxxx, got: ${priceId}`
      }, { status: 500 })
    }

    // Get student information
    const students = await sql`
      SELECT id, student_id, full_name, email, stripe_customer_id
      FROM students 
      WHERE id = ${parseInt(studentId)}
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
        { status: 400 }
      )
    }

    // Create or retrieve Stripe customer
    let customerId: string

    if (student.stripe_customer_id) {
      customerId = student.stripe_customer_id
    } else {
      const existingCustomers = await stripe.customers.list({
        email: student.email,
        limit: 1,
      })

      if (existingCustomers.data.length > 0) {
        customerId = existingCustomers.data[0].id
        // Update student record with Stripe customer ID
        await sql`
          UPDATE students 
          SET stripe_customer_id = ${customerId}
          WHERE id = ${parseInt(studentId)}
        `
      } else {
        const customer = await stripe.customers.create({
          email: student.email,
          name: student.full_name,
          metadata: {
            studentId: student.id.toString(),
          },
        })
        customerId = customer.id
        // Update student record with Stripe customer ID
        await sql`
          UPDATE students 
          SET stripe_customer_id = ${customerId}
          WHERE id = ${parseInt(studentId)}
        `
      }
    }

    // Check if student has an existing subscription
    // Note: Semester purchases are always one-time, so we don't update existing subscriptions
    const isSemester = cadence === "semester"
    const existingMembership = await sql`
      SELECT stripe_subscription_id, billing_cadence
      FROM memberships 
      WHERE student_id = ${parseInt(studentId)} AND stripe_subscription_id IS NOT NULL
      LIMIT 1
    `

    // PREVENT DUPLICATE SUBSCRIPTIONS: For monthly plans, check Stripe for active subs
    // Exception: Allow Explorer -> Trailblazer upgrade when student has canceled Explorer (still active until period end)
    if (!isSemester && customerId) {
      const activeSubs = await stripe.subscriptions.list({
        customer: customerId,
        status: "active",
        limit: 100,
      })
      if (activeSubs.data.length > 0) {
        const firstSub = activeSubs.data[0]
        const currentPriceId = firstSub.items?.data?.[0]?.price?.id
        const isCurrentlyExplorer = currentPriceId === STRIPE_PRODUCTS.Explorer
        const isUpgradeToTrailblazer = tier === "Trailblazer"
        const canUpgradeInPlace = isUpgradeToTrailblazer && isCurrentlyExplorer && existingMembership.length > 0 && existingMembership[0].stripe_subscription_id

        if (canUpgradeInPlace) {
          // Proceed to update block below - upgrade Explorer to Trailblazer without blocking
          console.log("[Membership Upgrade] Allowing Explorer -> Trailblazer upgrade (existing sub will be updated)")
        } else {
          // Student already has active subscription - redirect to manage instead of creating new
          return NextResponse.json(
            {
              error: "You already have an active subscription",
              code: "ALREADY_SUBSCRIBED",
              redirectToManage: true,
              message:
                "You already have an active membership. Please manage your subscription from the billing portal instead of creating a new one.",
            },
            { status: 400 }
          )
        }
      }
    }

    let checkoutSession

    // Only update existing subscription for monthly plans (not semester)
    if (!isSemester && existingMembership.length > 0 && existingMembership[0].stripe_subscription_id) {
      // Update existing subscription
      console.log("[Membership Upgrade] Updating existing Stripe subscription")
      try {
        const subscription = await stripe.subscriptions.retrieve(
          existingMembership[0].stripe_subscription_id
        )

        // Update subscription to new price; set cancel_at to semester end (no charges after, no refunds)
        const semesterEnd = await getSemesterEndDate()
        const cancelAt = Math.floor(semesterEnd.getTime() / 1000)
        await stripe.subscriptions.update(subscription.id, {
          items: [{
            id: subscription.items.data[0].id,
            price: priceId,
          }],
          cancel_at: cancelAt,
          metadata: {
            studentId: student.id.toString(),
            planId: tier,
            billingCadence: cadence,
          },
        })

        // Update database immediately (webhook will also update it)
        const expiresAt = semesterEnd.toISOString()
        await sql`
          UPDATE memberships
          SET 
            tier = ${tier},
            plan = ${tier},
            status = 'active',
            billing_cadence = ${cadence},
            expires_at = ${expiresAt}::timestamp,
            end_date = ${expiresAt}::timestamp,
            auto_renew = false,
            updated_at = CURRENT_TIMESTAMP
          WHERE student_id = ${parseInt(studentId)}
        `

        await sql`
          UPDATE students 
          SET membership_tier = ${tier}
          WHERE id = ${parseInt(studentId)}
        `

        return NextResponse.json({ 
          success: true, 
          message: "Membership updated successfully",
          requiresPayment: false
        })
      } catch (stripeError: any) {
        console.error("[Membership Upgrade] Stripe subscription update failed:", stripeError)
        // If subscription doesn't exist or is invalid, create new checkout
        if (stripeError.code === 'resource_missing' || stripeError.statusCode === 404) {
          console.log("[Membership Upgrade] Subscription not found, will create new checkout")
        } else {
          // For other errors, return the error
          return NextResponse.json({ 
            error: "Failed to update subscription",
            details: stripeError.message || "Stripe API error"
          }, { status: 500 })
        }
      }
    }

    const semesterLineItem =
      isSemester && (tier === "Explorer" || tier === "Trailblazer")
        ? await studentSemesterLineItem(tier)
        : { price: priceId!, quantity: 1 as const }

    // Create new checkout session
    const useRedirectCheckout = redirectCheckout === true
    const origin = request.nextUrl.origin
    const mobileReturns =
      mobileReturn === true ? mobileStudentMembershipReturnUrls(String(tier), cadence) : null
    console.log("[Membership Upgrade] Creating Stripe checkout session", { cadence, isSemester: cadence === "semester", useRedirectCheckout, mobileReturn: !!mobileReturns })
    try {
      // Hosted (redirect) checkout bypasses ad-blockers that block r.stripe.com in embedded mode
      if (useRedirectCheckout) {
        checkoutSession = await stripe.checkout.sessions.create({
          customer: customerId,
          ui_mode: "hosted",
          mode: isSemester ? "payment" : "subscription",
          payment_method_types: ["card"],
          line_items: [semesterLineItem],
          success_url: mobileReturns?.success_url ?? `${origin}/student/membership/success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: mobileReturns?.cancel_url ?? `${origin}/student/membership/cancel?plan=${tier}&cadence=${cadence}`,
          metadata: {
            studentId: student.id.toString(),
            planId: tier,
            billingCadence: cadence,
          },
          ...(isSemester ? {
            payment_intent_data: {
              metadata: {
                studentId: student.id.toString(),
                planId: tier,
                billingCadence: "semester",
              }
            }
          } : {})
        })
        return NextResponse.json({
          success: true,
          requiresPayment: true,
          redirectUrl: checkoutSession.url,
          sessionId: checkoutSession.id,
        })
      }

      checkoutSession = await stripe.checkout.sessions.create({
        customer: customerId,
        ui_mode: "embedded",
        mode: isSemester ? "payment" : "subscription", // One-time payment for semester, subscription for monthly
        payment_method_types: ["card"],
        line_items: [semesterLineItem],
        return_url: `${origin}/student/membership/success?session_id={CHECKOUT_SESSION_ID}`,
        metadata: {
          studentId: student.id.toString(),
          planId: tier,
          billingCadence: cadence,
        },
        // For semester plans, don't allow subscription updates
        ...(isSemester ? {
          payment_intent_data: {
            metadata: {
              studentId: student.id.toString(),
              planId: tier,
              billingCadence: "semester",
            }
          }
        } : {})
      })

      console.log("[Membership Upgrade] Checkout session created:", checkoutSession.id)

      return NextResponse.json({ 
        success: true, 
        requiresPayment: true,
        clientSecret: checkoutSession.client_secret,
        sessionId: checkoutSession.id
      })
    } catch (stripeError: any) {
      console.error("[Membership Upgrade] Stripe checkout failed:", stripeError?.message || stripeError)
      const msg = stripeError?.message || "Stripe API error"
      const code = stripeError?.code
      let hint: string | undefined
      if (msg.includes("No such price") || msg.includes("resource_missing")) {
        hint = "Price ID not found in Stripe. Check STRIPE_EXPLORER_SEMESTER_PRICE_ID and STRIPE_TRAILBLAZER_SEMESTER_PRICE_ID in Vercel match your Stripe dashboard. Remove any trailing spaces/newlines."
      } else if (msg.includes("recurring") || msg.includes("price")) {
        hint = "Semester price may be set as recurring in Stripe. Create a one-time price for semester plans."
      }
      return NextResponse.json({ 
        error: "Failed to create payment session",
        details: msg,
        code,
        hint,
      }, { status: 500 })
    }
  } catch (error: any) {
    console.error("[Membership Upgrade] Failed:", error?.message || error)
    
    // Provide more specific error messages
    let errorMessage = "Failed to upgrade membership"
    let errorDetails = error?.message || "Unknown error"
    
    // Hint for common Vercel env issues
    if (error?.message?.includes("DATABASE_URL") || error?.message?.includes("environment variable")) {
      errorDetails = "Server configuration error. Ensure DATABASE_URL and STRIPE_SECRET_KEY are set in Vercel environment variables."
    }
    
    if (error?.code === "resource_missing") {
      errorMessage = "Stripe resource not found"
      errorDetails = "The requested Stripe resource (price, customer, or subscription) was not found"
    } else if (error?.type === "StripeInvalidRequestError") {
      errorMessage = "Invalid Stripe request"
      errorDetails = error.message || "The request to Stripe was invalid"
    } else if (error?.type === "StripeAuthenticationError") {
      errorMessage = "Stripe authentication failed"
      errorDetails = "Stripe API key is invalid or expired"
    } else if (error?.type === "StripeAPIError") {
      errorMessage = "Stripe API error"
      errorDetails = error.message || "An error occurred with the Stripe API"
    }
    
    return NextResponse.json({ 
      error: errorMessage,
      details: errorDetails,
      code: error?.code,
      type: error?.type
    }, { status: 500 })
  }
}

