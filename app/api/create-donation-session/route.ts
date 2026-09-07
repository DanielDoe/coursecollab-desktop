import { type NextRequest, NextResponse } from "next/server"
import { stripe } from "@/lib/stripe"
import { sql } from "@/lib/db"
import { requireStudentIdParamMatchesCaller } from "@/lib/student-api-auth"

// Helper function to retry Stripe API calls with exponential backoff
async function retryStripeCall<T>(
  fn: () => Promise<T>,
  operation: string,
  maxRetries: number = 3
): Promise<T> {
  let lastError: any
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error: any) {
      lastError = error
      
      // Don't retry for certain error types (invalid API key, authentication errors)
      if (error?.type === "StripeAuthenticationError" || 
          error?.code === "api_key_expired" || 
          error?.code === "invalid_api_key") {
        throw error
      }
      
      // Retry on connection errors
      if ((error?.type === "StripeConnectionError" || error?.code === "connection_error") && attempt < maxRetries) {
        const delayMs = Math.min(1000 * Math.pow(2, attempt), 5000) // 1s, 2s, 4s, max 5s
        console.log(`[Donation Session] ${operation} failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delayMs}ms...`)
        await new Promise(resolve => setTimeout(resolve, delayMs))
        continue
      }
      
      throw error
    }
  }
  
  throw lastError
}

// Preset amount to price ID mapping
const PRESET_PRICE_IDS: Record<number, string> = {
  5: process.env.STRIPE_DONATION_PRICE_5 || "",
  10: process.env.STRIPE_DONATION_PRICE_10 || "",
  25: process.env.STRIPE_DONATION_PRICE_25 || "",
  50: process.env.STRIPE_DONATION_PRICE_50 || "",
  100: process.env.STRIPE_DONATION_PRICE_100 || "",
}

// Donation product ID - checked at runtime to handle missing env vars gracefully
const getDonationProductId = () => process.env.STRIPE_DONATION_PRODUCT_ID || ""

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    // Verify Stripe is configured
    if (!stripe) {
      console.error("[Donation Session] Stripe not configured - missing STRIPE_SECRET_KEY")
      console.error("[Donation Session] Environment check:", {
        hasSecretKey: !!process.env.STRIPE_SECRET_KEY,
        NODE_ENV: process.env.NODE_ENV,
        VERCEL: process.env.VERCEL,
        VERCEL_ENV: process.env.VERCEL_ENV,
      })
      return NextResponse.json(
        { 
          error: "Payment system is not configured. Please contact support.",
          details: "Stripe API key is missing",
          key: "key_missing"
        },
        { status: 500 }
      )
    }

    // Log Stripe configuration for debugging
    console.log("[Donation Session] Stripe configuration check:", {
      hasSecretKey: !!process.env.STRIPE_SECRET_KEY,
            hasProductId: !!process.env.STRIPE_DONATION_PRODUCT_ID,
      hasPrice5: !!process.env.STRIPE_DONATION_PRICE_5,
      NODE_ENV: process.env.NODE_ENV,
      VERCEL: process.env.VERCEL,
    })

    const body = await request.json()
    const { amount, donorName, email, message, studentId } = body

    if (studentId) {
      const auth = await requireStudentIdParamMatchesCaller(request, String(studentId))
      if (!auth.ok) return auth.response
    }

    // Validation - minimum $5 USD required to activate perks
    if (!amount || isNaN(amount) || amount < 5) {
      return NextResponse.json(
        { error: "Minimum donation of $5 USD is required to activate all premium perks." },
        { status: 400 }
      )
    }

    const amountInCents = Math.round(amount * 100)
    const finalDonorName = donorName?.trim() || "Anonymous"
    const finalEmail = email?.trim() || null
    const finalMessage = message?.trim() || null

    // Determine price ID or create dynamic price
    let priceId: string

    // Check if it's a preset amount with configured price ID
    const presetPriceId = PRESET_PRICE_IDS[amount]
    if (presetPriceId && presetPriceId.trim() !== "") {
      // Use preset price ID if configured
      priceId = presetPriceId
    } else {
      // Fallback: Create a dynamic price (for custom amounts or if preset prices aren't configured)
      const productId = getDonationProductId()
      
      if (!productId || productId.trim() === "") {
        console.error("[Donation Session] Missing STRIPE_DONATION_PRODUCT_ID environment variable")
        console.error("[Donation Session] Available env vars:", {
          hasSecretKey: !!process.env.STRIPE_SECRET_KEY,
          hasProductId: !!process.env.STRIPE_DONATION_PRODUCT_ID,
          hasPrice5: !!process.env.STRIPE_DONATION_PRICE_5,
          hasPrice10: !!process.env.STRIPE_DONATION_PRICE_10,
        })
        return NextResponse.json(
          { 
            error: "Donation system not fully configured. Please contact support.",
            details: "Missing STRIPE_DONATION_PRODUCT_ID environment variable"
          },
          { status: 500 }
        )
      }

      // Check if a price for this amount already exists
      try {
        console.log(`[Donation Session] Looking for existing price for $${amount} using product ${productId}`)
        console.log(`[Donation Session] Stripe config check:`, {
          hasSecretKey: !!process.env.STRIPE_SECRET_KEY,
                    productId: productId,
          apiVersion: "2024-12-18.acacia"
        })
        
        // Use retry wrapper for price list
        const existingPrices = await retryStripeCall(
          () => stripe.prices.list({
            product: productId,
            active: true,
            limit: 100,
          }),
          "list prices"
        )

        const matchingPrice = existingPrices.data.find(
          (p) => p.unit_amount === amountInCents && p.currency === "usd"
        )

        if (matchingPrice) {
          priceId = matchingPrice.id
          console.log(`[Donation Session] Using existing price ${priceId} for amount $${amount}`)
        } else {
          // Create new price for this amount (preset or custom)
          console.log(`[Donation Session] Creating new Stripe price for amount $${amount} using product ${productId}`)
          // Use retry wrapper for price creation
          const newPrice = await retryStripeCall(
            () => stripe.prices.create({
              product: productId,
              unit_amount: amountInCents,
              currency: "usd",
              metadata: {
                donation_amount: amount.toString(),
                type: presetPriceId ? "preset_donation" : "custom_donation",
              },
            }),
            "create price"
          )
          priceId = newPrice.id
          console.log(`[Donation Session] Created new price ${priceId} for amount $${amount}`)
        }
      } catch (stripeError: any) {
        // Log comprehensive error details for debugging
        console.error("[Donation Session] Stripe price creation error:", {
          message: stripeError?.message,
          type: stripeError?.type,
          code: stripeError?.code,
          statusCode: stripeError?.statusCode,
          requestId: stripeError?.requestId,
          headers: stripeError?.headers,
          stack: stripeError?.stack,
          raw: stripeError?.raw,
        })
        
        // Log environment check
        console.error("[Donation Session] Environment check:", {
          hasSecretKey: !!process.env.STRIPE_SECRET_KEY,
                    hasProductId: !!process.env.STRIPE_DONATION_PRODUCT_ID,
          nodeEnv: process.env.NODE_ENV,
          vercel: process.env.VERCEL,
        })
        
        // Provide user-friendly error message
        let errorMessage = "Failed to create donation checkout. Please try again."
        let errorDetails = stripeError?.message || "Stripe API error"
        
        if (stripeError?.type === "StripeConnectionError" || stripeError?.code === "connection_error") {
          errorMessage = "An error occurred with our connection to Stripe. Request was retried 2 times."
          errorDetails = `Connection error: ${stripeError?.message || "Unable to connect to Stripe API"}`
        } else if (stripeError?.code === "api_key_expired" || stripeError?.code === "invalid_api_key") {
          errorMessage = "Payment system configuration error. Please contact support."
          errorDetails = `API key error: ${stripeError?.message || "Invalid or expired Stripe API key"}`
        } else if (stripeError?.code === "resource_missing") {
          errorMessage = "Payment configuration error. Please contact support."
          errorDetails = `Product not found: ${stripeError?.message || "Donation product does not exist in Stripe"}`
        } else if (stripeError?.message) {
          errorMessage = `Stripe error: ${stripeError.message}`
          errorDetails = stripeError.message
        }
        
        return NextResponse.json(
          { 
            error: errorMessage,
            details: errorDetails,
            code: stripeError?.code,
            type: stripeError?.type
          },
          { status: 500 }
        )
      }
    }

    // Validate that we have a price ID
    if (!priceId || priceId.trim() === "") {
      console.error("[Donation Session] No valid price ID found for amount:", amount)
      return NextResponse.json(
        { 
          error: "Failed to set up donation checkout. Please contact support.",
          details: "Price ID not available"
        },
        { status: 500 }
      )
    }

    // Create Stripe Checkout Session
    let session
    try {
      // Use retry wrapper for checkout session creation
      session = await retryStripeCall(
        () => stripe.checkout.sessions.create({
          mode: "payment",
          payment_method_types: ["card"], // Card includes Apple Pay and Google Pay via Stripe's wallet support
          payment_method_options: {
            card: {
              request_three_d_secure: "automatic",
            },
          },
          line_items: [
            {
              price: priceId,
              quantity: 1,
            },
          ],
          success_url: `${process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin}/student/donate/success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin}/student/donate/cancelled`,
          metadata: {
            donorName: finalDonorName,
            email: finalEmail || "",
            message: finalMessage || "",
            studentId: studentId?.toString() || "",
            amount: amount.toString(),
            type: "donation",
          },
          customer_email: finalEmail || undefined,
        }),
        "create checkout session"
      )
    } catch (sessionError: any) {
      // Log comprehensive error details for debugging
      console.error("[Donation Session] Stripe checkout session creation error:", {
        message: sessionError?.message,
        type: sessionError?.type,
        code: sessionError?.code,
        statusCode: sessionError?.statusCode,
        requestId: sessionError?.requestId,
        headers: sessionError?.headers,
        stack: sessionError?.stack,
        priceId: priceId,
      })
      
      // Provide user-friendly error message
      let errorMessage = "Failed to create donation checkout. Please try again."
      let errorDetails = sessionError?.message || "Stripe API error"
      
      if (sessionError?.type === "StripeConnectionError" || sessionError?.code === "connection_error") {
        errorMessage = "An error occurred with our connection to Stripe. Request was retried 2 times."
        errorDetails = `Connection error: ${sessionError?.message || "Unable to connect to Stripe API"}`
      } else if (sessionError?.code === "api_key_expired" || sessionError?.code === "invalid_api_key") {
        errorMessage = "Payment system configuration error. Please contact support."
        errorDetails = `API key error: ${sessionError?.message || "Invalid or expired Stripe API key"}`
      } else if (sessionError?.code === "resource_missing") {
        errorMessage = "Payment configuration error. Please contact support."
        errorDetails = `Price not found: ${sessionError?.message || "Price does not exist in Stripe"}`
      } else if (sessionError?.message) {
        errorMessage = `Stripe error: ${sessionError.message}`
        errorDetails = sessionError.message
      }
      
      return NextResponse.json(
        { 
          error: errorMessage,
          details: errorDetails,
          code: sessionError?.code,
          type: sessionError?.type
        },
        { status: 500 }
      )
    }

    // Store donation record in database BEFORE creating checkout session
    // This ensures we have a record even if webhook fails
    let donationRecordId: number | null = null
    try {
      console.log("[Donation Session] Creating donation record:", {
        studentId,
        amount,
        donorName: finalDonorName,
        isAnonymous: finalDonorName === "Anonymous"
      })

      // Check if deleted_at column exists
      let hasDeletedAtColumn = false
      try {
        const columnCheck = await sql`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'donations' AND column_name = 'deleted_at'
        `
        hasDeletedAtColumn = columnCheck.length > 0
      } catch (e) {
        // Ignore - assume column doesn't exist
      }

      const donationResult = hasDeletedAtColumn
        ? await sql`
            INSERT INTO donations (
              student_id,
              donor_name,
              donor_email,
              amount,
              message,
              is_anonymous,
              status,
              transaction_id,
              deleted_at
            ) VALUES (
              ${studentId ? parseInt(studentId) : null},
              ${finalDonorName === "Anonymous" ? "Anonymous" : finalDonorName},
              ${finalEmail || null},
              ${amount},
              ${finalMessage || null},
              ${finalDonorName === "Anonymous"},
              'pending',
              ${session.id},
              NULL
            )
            RETURNING id
          `
        : await sql`
            INSERT INTO donations (
              student_id,
              donor_name,
              donor_email,
              amount,
              message,
              is_anonymous,
              status,
              transaction_id
            ) VALUES (
              ${studentId ? parseInt(studentId) : null},
              ${finalDonorName === "Anonymous" ? "Anonymous" : finalDonorName},
              ${finalEmail || null},
              ${amount},
              ${finalMessage || null},
              ${finalDonorName === "Anonymous"},
              'pending',
              ${session.id}
            )
            RETURNING id
          `
      
      donationRecordId = donationResult[0]?.id || null
      console.log(`[Donation Session] Donation record created with ID: ${donationRecordId}`)
    } catch (dbError: any) {
      // Log detailed error but don't fail the request
      console.error("[Donation Session] Failed to store donation record:", {
        error: dbError?.message,
        stack: dbError?.stack,
        code: dbError?.code,
        detail: dbError?.detail
      })
      // Continue anyway - webhook will create record if this fails
    }

    // Store donation ID in session metadata for webhook processing
    if (donationRecordId) {
      try {
        await retryStripeCall(
          () => stripe.checkout.sessions.update(session.id, {
            metadata: {
              ...session.metadata,
              donationId: donationRecordId.toString(),
            },
          }),
          "update checkout session metadata"
        )
      } catch (updateError: any) {
        // Log but don't fail - metadata update is optional
        console.error("[Donation Session] Failed to update session metadata:", updateError?.message)
      }
    }

    return NextResponse.json({ url: session.url })
  } catch (err: any) {
    // Log comprehensive error details for debugging
    console.error("[Stripe Production Error]", {
      message: err?.message,
      type: err?.type,
      code: err?.code,
      statusCode: err?.statusCode,
      requestId: err?.requestId,
      stack: err?.stack,
      headers: err?.headers,
    })
    
    console.error("[Donation Session] Environment at error time:", {
      hasSecretKey: !!process.env.STRIPE_SECRET_KEY,
            hasProductId: !!process.env.STRIPE_DONATION_PRODUCT_ID,
      NODE_ENV: process.env.NODE_ENV,
      VERCEL: process.env.VERCEL,
      VERCEL_ENV: process.env.VERCEL_ENV,
    })
    
    // Check if it's a Stripe connection error
    if (err?.type === "StripeConnectionError" || err?.code === "connection_error") {
      return NextResponse.json(
        { 
          error: "Stripe connection failed in production",
          details: err?.message || "An error occurred with our connection to Stripe. Request was retried 2 times.",
          type: err?.type,
          code: err?.code,
          key: process.env.STRIPE_SECRET_KEY ? "key_present" : "key_missing",
          requestId: err?.requestId,
        },
        { status: 500 }
      )
    }
    
    // Check for authentication errors
    if (err?.type === "StripeAuthenticationError" || err?.code === "api_key_expired" || err?.code === "invalid_api_key") {
      return NextResponse.json(
        { 
          error: "Payment system configuration error. Please contact support.",
          details: `API key error: ${err?.message || "Invalid or expired Stripe API key"}`,
          type: err?.type,
          code: err?.code,
          key: process.env.STRIPE_SECRET_KEY ? "key_present" : "key_missing",
        },
        { status: 500 }
      )
    }
    
    // Generic error handler
    return NextResponse.json(
      { 
        error: err?.message || "Failed to create donation session",
        details: err?.message || "An unexpected error occurred",
        type: err?.type,
        code: err?.code,
        key: process.env.STRIPE_SECRET_KEY ? "key_present" : "key_missing",
        requestId: err?.requestId,
      },
      { status: 500 }
    )
  }
}

