import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { stripe } from "@/lib/stripe"
import { requireStudentIdParamMatchesCaller } from "@/lib/student-api-auth"

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Check and update pending donations that were successful in Stripe
 * This syncs donation status when webhooks might have been missed
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { studentId, transactionId } = body

    if (!studentId) {
      return NextResponse.json({ error: "Student ID is required" }, { status: 400 })
    }
    const auth = await requireStudentIdParamMatchesCaller(request, String(studentId))
    if (!auth.ok) return auth.response

    console.log(`[Sync Pending] Checking pending donations for student: ${auth.studentDbId}, transaction: ${transactionId || 'all'}`)

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

    // Get pending donations
    let pendingDonations
    if (transactionId) {
      // Check specific transaction
      pendingDonations = hasDeletedAtColumn
        ? await sql`
            SELECT 
              id,
              student_id,
              amount,
              status,
              transaction_id,
              created_at
            FROM donations
            WHERE transaction_id = ${transactionId}
              AND status = 'pending'
              AND deleted_at IS NULL
            ORDER BY created_at DESC
          `
        : await sql`
            SELECT 
              id,
              student_id,
              amount,
              status,
              transaction_id,
              created_at
            FROM donations
            WHERE transaction_id = ${transactionId}
              AND status = 'pending'
            ORDER BY created_at DESC
          `
    } else if (studentId) {
      // Check all pending donations for a student
      pendingDonations = hasDeletedAtColumn
        ? await sql`
            SELECT 
              id,
              student_id,
              amount,
              status,
              transaction_id,
              created_at
            FROM donations
            WHERE student_id = ${parseInt(studentId)}
              AND status = 'pending'
              AND deleted_at IS NULL
              AND transaction_id IS NOT NULL
              AND created_at >= NOW() - INTERVAL '24 hours'
            ORDER BY created_at DESC
          `
        : await sql`
            SELECT 
              id,
              student_id,
              amount,
              status,
              transaction_id,
              created_at
            FROM donations
            WHERE student_id = ${parseInt(studentId)}
              AND status = 'pending'
              AND transaction_id IS NOT NULL
              AND created_at >= NOW() - INTERVAL '24 hours'
            ORDER BY created_at DESC
          `
    } else {
      // Check all recent pending donations (last 24 hours)
      pendingDonations = hasDeletedAtColumn
        ? await sql`
            SELECT 
              id,
              student_id,
              amount,
              status,
              transaction_id,
              created_at
            FROM donations
            WHERE status = 'pending'
              AND transaction_id IS NOT NULL
              AND created_at >= NOW() - INTERVAL '24 hours'
              AND deleted_at IS NULL
            ORDER BY created_at DESC
            LIMIT 50
          `
        : await sql`
            SELECT 
              id,
              student_id,
              amount,
              status,
              transaction_id,
              created_at
            FROM donations
            WHERE status = 'pending'
              AND transaction_id IS NOT NULL
              AND created_at >= NOW() - INTERVAL '24 hours'
            ORDER BY created_at DESC
            LIMIT 50
          `
    }

    if (pendingDonations.length === 0) {
      return NextResponse.json({
        updated: 0,
        checked: 0,
        message: "No pending donations found"
      })
    }

    console.log(`[Sync Pending] Found ${pendingDonations.length} pending donation(s) to check`)

    let updatedCount = 0
    let checkedCount = 0
    const errors: any[] = []

    // Check each pending donation with Stripe
    for (const donation of pendingDonations) {
      if (!donation.transaction_id) {
        continue
      }

      checkedCount++
      try {
        // Retrieve checkout session from Stripe
        const session = await stripe.checkout.sessions.retrieve(donation.transaction_id, {
          expand: ['line_items', 'payment_intent', 'payment_intent.latest_charge']
        })

        console.log(`[Sync Pending] Checking donation ${donation.id}, session ${donation.transaction_id}, payment_status: ${session.payment_status}`)

        // If payment is paid, update donation status
        if (session.payment_status === 'paid') {
          const actualAmount = session.amount_total ? (session.amount_total / 100) : parseFloat(donation.amount.toString())
          
          // Extract payment method from charge (most reliable)
          let paymentMethod = 'stripe'
          try {
            if (session.payment_intent) {
              const paymentIntent = typeof session.payment_intent === 'string' 
                ? await stripe.paymentIntents.retrieve(session.payment_intent, {
                    expand: ['latest_charge']
                  })
                : session.payment_intent
              
              // Try to get payment method from latest charge first
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
                    paymentMethod = pmDetails.type || 'stripe'
                  }
                }
              }
              
              // Fallback: try payment method directly from payment intent
              if (paymentMethod === 'stripe' && paymentIntent.payment_method) {
                const pm = typeof paymentIntent.payment_method === 'string'
                  ? await stripe.paymentMethods.retrieve(paymentIntent.payment_method)
                  : paymentIntent.payment_method
                
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
          } catch (error) {
            console.error(`[Sync Pending] Failed to retrieve payment method:`, error)
            // Default to stripe_card if we can't determine
            if (paymentMethod === 'stripe') {
              paymentMethod = 'stripe_card'
            }
          }
          
          // Ensure we always have a payment method
          if (!paymentMethod || paymentMethod === 'stripe') {
            paymentMethod = 'stripe_card'
          }
          
          console.log(`[Sync Pending] Using payment method: ${paymentMethod}`)
          
          // Update donation - conditionally include error_message and failed_at if columns exist
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
            updatedCount++
            console.log(`[Sync Pending] ✅ Updated donation ${donation.id} from pending to completed (amount: $${actualAmount}, method: ${paymentMethod})`)
          }
        } else if (session.payment_status === 'unpaid' && session.status === 'expired') {
          // Mark expired sessions as failed - conditionally include error_message and failed_at if columns exist
          let updateResult
          if (hasDeletedAtColumn && hasErrorMessageColumn && hasFailedAtColumn) {
            updateResult = await sql`
              UPDATE donations
              SET 
                status = 'failed',
                error_message = 'Checkout session expired',
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
                error_message = 'Checkout session expired',
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
            console.log(`[Sync Pending] ⚠️ Marked donation ${donation.id} as failed (expired)`)
          }
        } else if (session.payment_status === 'unpaid' && session.status === 'open') {
          // Check if session has been open for more than 24 hours - mark as failed (abandoned)
          const sessionAge = Date.now() - (session.created * 1000)
          const hoursOpen = sessionAge / (1000 * 60 * 60)
          
          if (hoursOpen > 24) {
            console.log(`[Sync Pending] ⚠️ Donation ${donation.id} has been open for ${hoursOpen.toFixed(1)} hours - marking as failed (abandoned)`)
            
            // Mark as failed - conditionally include error_message and failed_at if columns exist
            let updateResult
            if (hasDeletedAtColumn && hasErrorMessageColumn && hasFailedAtColumn) {
              updateResult = await sql`
                UPDATE donations
                SET 
                  status = 'failed',
                  error_message = 'Checkout session abandoned (open for more than 24 hours)',
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
                  error_message = 'Checkout session abandoned (open for more than 24 hours)',
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
              console.log(`[Sync Pending] ⚠️ Marked donation ${donation.id} as failed (abandoned after ${hoursOpen.toFixed(1)} hours)`)
              
              // Send notification to student about failed payment
              try {
                const { createNotification } = await import("@/lib/create-notification")
                await createNotification({
                  studentId: donation.student_id,
                  type: "donation",
                  title: "Payment Not Completed",
                  message: `Your donation payment was not completed. The checkout session expired. If you'd like to donate, please try again.`,
                  link: "/student/donate"
                })
                console.log(`[Sync Pending] ✅ Notification sent to student ${donation.student_id} about abandoned donation`)
              } catch (error) {
                console.error(`[Sync Pending] Failed to send notification:`, error)
              }
            }
          } else {
              console.log(`[Sync Pending] ⏳ Donation ${donation.id} still pending (payment_status: ${session.payment_status}, status: ${session.status}, open for ${hoursOpen.toFixed(1)} hours)`)
          }
        } else {
          console.log(`[Sync Pending] ⏳ Donation ${donation.id} still pending (payment_status: ${session.payment_status}, status: ${session.status})`)
        }
      } catch (error: any) {
        console.error(`[Sync Pending] ❌ Failed to check donation ${donation.id}:`, error.message)
        errors.push({
          donationId: donation.id,
          transactionId: donation.transaction_id,
          error: error.message
        })
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    return NextResponse.json({
      updated: updatedCount,
      checked: checkedCount,
      total: pendingDonations.length,
      errors: errors.length > 0 ? errors : undefined,
      message: `Checked ${checkedCount} donation(s), updated ${updatedCount} to completed`
    })
  } catch (error: any) {
    console.error("[Sync Pending] Error:", error)
    return NextResponse.json(
      { error: "Failed to sync pending donations", details: error.message },
      { status: 500 }
    )
  }
}

