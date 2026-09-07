import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { stripe } from "@/lib/stripe"
import { requireStudentIdParamMatchesCaller } from "@/lib/student-api-auth"

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Check donation status and verify with Stripe if still pending
 * This allows the frontend to poll and update status when webhook confirms payment
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const transactionId = searchParams.get("transaction_id")
    const studentId = searchParams.get("student_id")

    if (!transactionId) {
      return NextResponse.json(
        { error: "Transaction ID is required" },
        { status: 400 }
      )
    }

    if (studentId) {
      const auth = await requireStudentIdParamMatchesCaller(request, studentId)
      if (!auth.ok) return auth.response
    }

    console.log(`[Check Status] Checking donation status for transaction: ${transactionId}`)

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

    // Get donation by transaction_id
    const donations = hasDeletedAtColumn
      ? await sql`
          SELECT 
            id,
            student_id,
            amount,
            status,
            transaction_id,
            created_at,
            updated_at
          FROM donations
          WHERE transaction_id = ${transactionId}
            AND deleted_at IS NULL
          ORDER BY created_at DESC
          LIMIT 1
        `
      : await sql`
          SELECT 
            id,
            student_id,
            amount,
            status,
            transaction_id,
            created_at,
            updated_at
          FROM donations
          WHERE transaction_id = ${transactionId}
          ORDER BY created_at DESC
          LIMIT 1
        `

    if (donations.length === 0) {
      // Donation not found in database - might need to verify with Stripe
      if (studentId) {
        // Try to find by student_id and check with Stripe
        try {
          const session = await stripe.checkout.sessions.retrieve(transactionId, {
            expand: ['line_items', 'payment_intent']
          })

          if (session.payment_status === 'paid' && session.metadata?.type === 'donation') {
            const actualAmount = session.amount_total ? (session.amount_total / 100) : parseFloat(session.metadata?.amount || "0")
            
            // Create donation record since it doesn't exist
            const insertResult = hasDeletedAtColumn
              ? await sql`
                  INSERT INTO donations (
                    student_id,
                    amount,
                    donor_name,
                    donor_email,
                    status,
                    transaction_id,
                    is_anonymous,
                    message,
                    deleted_at
                  )
                  VALUES (
                    ${parseInt(studentId)},
                    ${actualAmount},
                    ${session.metadata?.donorName || 'Anonymous'},
                    ${session.metadata?.email || null},
                    'completed',
                    ${transactionId},
                    ${session.metadata?.donorName === 'Anonymous'},
                    ${session.metadata?.message || null},
                    NULL
                  )
                  RETURNING id, status
                `
              : await sql`
                  INSERT INTO donations (
                    student_id,
                    amount,
                    donor_name,
                    donor_email,
                    status,
                    transaction_id,
                    is_anonymous,
                    message
                  )
                  VALUES (
                    ${parseInt(studentId)},
                    ${actualAmount},
                    ${session.metadata?.donorName || 'Anonymous'},
                    ${session.metadata?.email || null},
                    'completed',
                    ${transactionId},
                    ${session.metadata?.donorName === 'Anonymous'},
                    ${session.metadata?.message || null}
                  )
                  RETURNING id, status
                `
            
            return NextResponse.json({
              donationId: insertResult[0].id,
              status: insertResult[0].status,
              verified: true,
              message: "Donation found in Stripe and created in database"
            })
          }
        } catch (error: any) {
          console.error("[Check Status] Failed to verify with Stripe:", error)
        }
      }

      return NextResponse.json({
        found: false,
        message: "Donation not found"
      })
    }

    const donation = donations[0]

    // If donation is already completed, return it
    if (donation.status === 'completed') {
      return NextResponse.json({
        found: true,
        donationId: donation.id,
        status: donation.status,
        verified: true,
        message: "Donation already completed"
      })
    }

    // If donation is pending, verify with Stripe
    if (donation.status === 'pending') {
      try {
        const session = await stripe.checkout.sessions.retrieve(transactionId, {
          expand: ['line_items', 'payment_intent']
        })

        console.log(`[Check Status] Stripe session payment_status: ${session.payment_status}`)

        // If payment is paid, update donation status to completed
        if (session.payment_status === 'paid') {
          const actualAmount = session.amount_total ? (session.amount_total / 100) : parseFloat(donation.amount.toString())
          
          const updateResult = hasDeletedAtColumn
            ? await sql`
                UPDATE donations
                SET 
                  status = 'completed',
                  amount = ${actualAmount},
                  updated_at = CURRENT_TIMESTAMP
                WHERE id = ${donation.id}
                  AND deleted_at IS NULL
                RETURNING id, status
              `
            : await sql`
                UPDATE donations
                SET 
                  status = 'completed',
                  amount = ${actualAmount},
                  updated_at = CURRENT_TIMESTAMP
                WHERE id = ${donation.id}
                RETURNING id, status
              `

          if (updateResult && updateResult.length > 0) {
            console.log(`[Check Status] Updated donation ${donation.id} from pending to completed`)
            
            return NextResponse.json({
              found: true,
              donationId: donation.id,
              status: 'completed',
              verified: true,
              updated: true,
              message: "Donation verified and updated to completed"
            })
          }
        } else {
          // Payment not yet completed
          return NextResponse.json({
            found: true,
            donationId: donation.id,
            status: donation.status,
            verified: false,
            paymentStatus: session.payment_status,
            message: "Payment not yet completed"
          })
        }
      } catch (error: any) {
        console.error("[Check Status] Failed to verify with Stripe:", error)
        return NextResponse.json({
          found: true,
          donationId: donation.id,
          status: donation.status,
          verified: false,
          error: error.message,
          message: "Failed to verify payment status with Stripe"
        })
      }
    }

    // Return current status
    return NextResponse.json({
      found: true,
      donationId: donation.id,
      status: donation.status,
      verified: false,
      message: `Donation status: ${donation.status}`
    })
  } catch (error: any) {
    console.error("[Check Status] Error:", error)
    return NextResponse.json(
      { error: "Failed to check donation status", details: error.message },
      { status: 500 }
    )
  }
}

