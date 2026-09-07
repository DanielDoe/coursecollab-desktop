import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { stripe } from "@/lib/stripe"
import { createNotification } from "@/lib/create-notification"

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Manually resolve a pending donation
 * Can mark as completed (if payment was successful) or failed (if payment failed/abandoned)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { action, reason } = body // action: 'complete' | 'fail', reason: optional string

    if (!action || !['complete', 'fail'].includes(action)) {
      return NextResponse.json(
        { error: "Invalid action. Must be 'complete' or 'fail'" },
        { status: 400 }
      )
    }

    console.log(`[Resolve Donation] Resolving donation ${id} with action: ${action}`)

    // Check if deleted_at column exists
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

    // Get donation details
    const donations = hasDeletedAtColumn
      ? await sql`
          SELECT 
            id,
            student_id,
            amount,
            status,
            transaction_id
          FROM donations
          WHERE id = ${parseInt(id)}
            AND deleted_at IS NULL
          LIMIT 1
        `
      : await sql`
          SELECT 
            id,
            student_id,
            amount,
            status,
            transaction_id
          FROM donations
          WHERE id = ${parseInt(id)}
          LIMIT 1
        `

    if (donations.length === 0) {
      return NextResponse.json({ error: "Donation not found" }, { status: 404 })
    }

    const donation = donations[0]

    if (donation.status !== 'pending') {
      return NextResponse.json(
        { error: `Donation is already ${donation.status}. Cannot resolve.` },
        { status: 400 }
      )
    }

    // If action is 'complete', verify with Stripe first
    if (action === 'complete') {
      if (!donation.transaction_id) {
        return NextResponse.json(
          { error: "Cannot complete donation without transaction ID" },
          { status: 400 }
        )
      }

      try {
        const session = await stripe.checkout.sessions.retrieve(donation.transaction_id, {
          expand: ['payment_intent', 'payment_intent.latest_charge']
        })

        if (session.payment_status !== 'paid') {
          return NextResponse.json(
            { 
              error: `Payment is not paid in Stripe (status: ${session.payment_status}). Cannot mark as completed.`,
              paymentStatus: session.payment_status
            },
            { status: 400 }
          )
        }

        // Payment is paid - update to completed
        const actualAmount = session.amount_total ? (session.amount_total / 100) : parseFloat(donation.amount.toString())
        
        // Extract payment method
        let paymentMethod = 'stripe_card'
        try {
          if (session.payment_intent) {
            const paymentIntent = typeof session.payment_intent === 'string' 
              ? await stripe.paymentIntents.retrieve(session.payment_intent, {
                  expand: ['latest_charge']
                })
              : session.payment_intent
            
            if (paymentIntent.latest_charge) {
              const charge = typeof paymentIntent.latest_charge === 'string'
                ? await stripe.charges.retrieve(paymentIntent.latest_charge)
                : paymentIntent.latest_charge
              
              if (charge.payment_method_details) {
                const pmDetails = charge.payment_method_details
                if (pmDetails.type === 'card') {
                  const cardDetails = pmDetails.card
                  if (cardDetails?.wallet?.type === 'apple_pay') {
                    paymentMethod = 'apple_pay'
                  } else if (cardDetails?.wallet?.type === 'google_pay') {
                    paymentMethod = 'google_pay'
                  } else {
                    paymentMethod = 'stripe_card'
                  }
                } else {
                  paymentMethod = pmDetails.type || 'stripe_card'
                }
              }
            }
          }
        } catch (error) {
          console.error("[Resolve Donation] Failed to get payment method:", error)
        }

        // Update donation to completed
        let updateResult
        if (hasDeletedAtColumn && hasErrorMessageColumn && hasFailedAtColumn) {
          updateResult = await sql`
            UPDATE donations
            SET 
              status = 'completed',
              amount = ${actualAmount},
              payment_method = ${paymentMethod},
              error_message = NULL,
              failed_at = NULL,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ${donation.id}
              AND status = 'pending'
              AND deleted_at IS NULL
            RETURNING id, status
          `
        } else if (hasDeletedAtColumn) {
          updateResult = await sql`
            UPDATE donations
            SET 
              status = 'completed',
              amount = ${actualAmount},
              payment_method = ${paymentMethod},
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ${donation.id}
              AND status = 'pending'
              AND deleted_at IS NULL
            RETURNING id, status
          `
        } else if (hasErrorMessageColumn && hasFailedAtColumn) {
          updateResult = await sql`
            UPDATE donations
            SET 
              status = 'completed',
              amount = ${actualAmount},
              payment_method = ${paymentMethod},
              error_message = NULL,
              failed_at = NULL,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ${donation.id}
              AND status = 'pending'
            RETURNING id, status
          `
        } else {
          updateResult = await sql`
            UPDATE donations
            SET 
              status = 'completed',
              amount = ${actualAmount},
              payment_method = ${paymentMethod},
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ${donation.id}
              AND status = 'pending'
            RETURNING id, status
          `
        }

        if (updateResult && updateResult.length > 0) {
          // Grant donation perks
          try {
            const { grantDonationPerks } = await import("@/lib/membership")
            await grantDonationPerks(donation.student_id)
            console.log(`[Resolve Donation] ✅ Granted donation perks to student ${donation.student_id}`)
          } catch (error) {
            console.error("[Resolve Donation] Failed to grant perks:", error)
          }

          // Send success notification
          try {
            await createNotification({
              studentId: donation.student_id,
              type: "donation",
              title: "Donation Confirmed",
              message: `Your donation of $${actualAmount.toFixed(2)} has been confirmed and processed successfully! Thank you for your support!`,
              link: "/student/donate"
            })
          } catch (error) {
            console.error("[Resolve Donation] Failed to send notification:", error)
          }

          return NextResponse.json({
            success: true,
            message: "Donation marked as completed",
            donation: {
              id: updateResult[0].id,
              status: updateResult[0].status
            }
          })
        }
      } catch (error: any) {
        console.error("[Resolve Donation] Failed to verify with Stripe:", error)
        return NextResponse.json(
          { error: "Failed to verify payment with Stripe", details: error.message },
          { status: 500 }
        )
      }
    } else if (action === 'fail') {
      // Mark as failed
      let updateResult
      const errorMessage = reason || 'Manually marked as failed by admin'
      
      if (hasDeletedAtColumn && hasErrorMessageColumn && hasFailedAtColumn) {
        updateResult = await sql`
          UPDATE donations
          SET 
            status = 'failed',
            error_message = ${errorMessage},
            failed_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ${donation.id}
            AND status = 'pending'
            AND deleted_at IS NULL
          RETURNING id, status
        `
      } else if (hasDeletedAtColumn) {
        updateResult = await sql`
          UPDATE donations
          SET 
            status = 'failed',
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ${donation.id}
            AND status = 'pending'
            AND deleted_at IS NULL
          RETURNING id, status
        `
      } else if (hasErrorMessageColumn && hasFailedAtColumn) {
        updateResult = await sql`
          UPDATE donations
          SET 
            status = 'failed',
            error_message = ${errorMessage},
            failed_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ${donation.id}
            AND status = 'pending'
          RETURNING id, status
        `
      } else {
        updateResult = await sql`
          UPDATE donations
          SET 
            status = 'failed',
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ${donation.id}
            AND status = 'pending'
          RETURNING id, status
        `
      }

      if (updateResult && updateResult.length > 0) {
        // Send failure notification
        try {
          await createNotification({
            studentId: donation.student_id,
            type: "donation",
            title: "Payment Not Completed",
            message: `Your donation payment was not completed. ${errorMessage}. If you'd like to donate, please try again.`,
            link: "/student/donate"
          })
        } catch (error) {
          console.error("[Resolve Donation] Failed to send notification:", error)
        }

        return NextResponse.json({
          success: true,
          message: "Donation marked as failed",
          donation: {
            id: updateResult[0].id,
            status: updateResult[0].status
          }
        })
      }
    }

    return NextResponse.json(
      { error: "Failed to update donation" },
      { status: 500 }
    )
  } catch (error: any) {
    console.error("[Resolve Donation] Error:", error)
    return NextResponse.json(
      { error: "Failed to resolve donation", details: error.message },
      { status: 500 }
    )
  }
}

