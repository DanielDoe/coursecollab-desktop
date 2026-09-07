import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { stripe } from "@/lib/stripe"
import { requireStudentIdParamMatchesCaller } from "@/lib/student-api-auth"

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Verify a Stripe checkout session and update donation status if payment was successful
 * This is a fallback mechanism in case the webhook doesn't fire or is delayed
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { sessionId, studentId } = body

    if (!sessionId) {
      return NextResponse.json(
        { error: "Session ID is required" },
        { status: 400 }
      )
    }

    if (!studentId) {
      return NextResponse.json(
        { error: "Student ID is required" },
        { status: 400 }
      )
    }

    const auth = await requireStudentIdParamMatchesCaller(request, String(studentId))
    if (!auth.ok) return auth.response

    console.log(`[Verify Session] Verifying session ${sessionId} for student ${auth.studentDbId}`)

    // Retrieve the checkout session from Stripe
    let session
    try {
      session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ['line_items', 'payment_intent']
      })
    } catch (error: any) {
      console.error("[Verify Session] Failed to retrieve session from Stripe:", error)
      return NextResponse.json(
        { error: "Failed to verify session with Stripe", details: error.message },
        { status: 500 }
      )
    }

    // Check if payment was successful
    if (session.payment_status !== 'paid') {
      console.log(`[Verify Session] Payment not completed. Status: ${session.payment_status}`)
      return NextResponse.json({
        verified: false,
        paymentStatus: session.payment_status,
        message: "Payment not yet completed"
      })
    }

    // Check if this is a donation
    if (session.metadata?.type !== 'donation') {
      return NextResponse.json({
        verified: false,
        message: "This session is not a donation"
      })
    }

    const actualAmount = session.amount_total ? (session.amount_total / 100) : parseFloat(session.metadata?.amount || "0")
    const donationId = session.metadata?.donationId

    console.log(`[Verify Session] Payment successful. Amount: $${actualAmount}, DonationId: ${donationId}`)

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

    // Try to update donation status
    let donationUpdated = false
    let updatedDonationId: number | null = null

    // First try by donationId if provided
    if (donationId) {
      try {
        if (hasDeletedAtColumn) {
          const updateResult = await sql`
            UPDATE donations
            SET 
              status = 'completed', 
              transaction_id = ${session.id},
              amount = ${actualAmount},
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ${parseInt(donationId)}
              AND deleted_at IS NULL
              AND status != 'completed'
            RETURNING id
          `
          if (updateResult && updateResult.length > 0) {
            donationUpdated = true
            updatedDonationId = updateResult[0].id
            console.log(`[Verify Session] Updated donation ${donationId} to completed`)
          }
        } else {
          const updateResult = await sql`
            UPDATE donations
            SET 
              status = 'completed', 
              transaction_id = ${session.id},
              amount = ${actualAmount},
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ${parseInt(donationId)}
              AND status != 'completed'
            RETURNING id
          `
          if (updateResult && updateResult.length > 0) {
            donationUpdated = true
            updatedDonationId = updateResult[0].id
            console.log(`[Verify Session] Updated donation ${donationId} to completed`)
          }
        }
      } catch (error: any) {
        console.error("[Verify Session] Failed to update by donationId:", error)
      }
    }

    // If not updated by donationId, try by transaction_id and studentId
    if (!donationUpdated) {
      try {
        console.log(`[Verify Session] Searching for pending donation by transaction_id: ${session.id}`)
        
        if (hasDeletedAtColumn) {
          const updateResult = await sql`
            UPDATE donations
            SET 
              status = 'completed', 
              transaction_id = ${session.id},
              amount = ${actualAmount},
              updated_at = CURRENT_TIMESTAMP
            WHERE student_id = ${parseInt(studentId)}
              AND (
                transaction_id = ${session.id} 
                OR (status = 'pending' AND transaction_id IS NULL)
                OR (status = 'pending' AND created_at >= NOW() - INTERVAL '1 hour')
              )
              AND deleted_at IS NULL
            ORDER BY created_at DESC
            LIMIT 1
            RETURNING id
          `
          if (updateResult && updateResult.length > 0) {
            donationUpdated = true
            updatedDonationId = updateResult[0].id
            console.log(`[Verify Session] Updated donation ${updatedDonationId} by transaction_id to completed`)
          }
        } else {
          const updateResult = await sql`
            UPDATE donations
            SET 
              status = 'completed', 
              transaction_id = ${session.id},
              amount = ${actualAmount},
              updated_at = CURRENT_TIMESTAMP
            WHERE student_id = ${parseInt(studentId)}
              AND (
                transaction_id = ${session.id} 
                OR (status = 'pending' AND transaction_id IS NULL)
                OR (status = 'pending' AND created_at >= NOW() - INTERVAL '1 hour')
              )
            ORDER BY created_at DESC
            LIMIT 1
            RETURNING id
          `
          if (updateResult && updateResult.length > 0) {
            donationUpdated = true
            updatedDonationId = updateResult[0].id
            console.log(`[Verify Session] Updated donation ${updatedDonationId} by transaction_id to completed`)
          }
        }
      } catch (error: any) {
        console.error("[Verify Session] Failed to update by transaction_id:", error)
      }
    }

    // If still not updated, create new donation record
    if (!donationUpdated) {
      try {
        console.log(`[Verify Session] Creating new donation record for student ${studentId}`)
        
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
                ${session.id},
                ${session.metadata?.donorName === 'Anonymous'},
                ${session.metadata?.message || null},
                NULL
              )
              RETURNING id
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
                ${session.id},
                ${session.metadata?.donorName === 'Anonymous'},
                ${session.metadata?.message || null}
              )
              RETURNING id
            `
        
        if (insertResult && insertResult.length > 0) {
          donationUpdated = true
          updatedDonationId = insertResult[0].id
          console.log(`[Verify Session] Created donation record ${updatedDonationId}`)
        }
      } catch (error: any) {
        console.error("[Verify Session] Failed to create donation record:", error)
      }
    }

    return NextResponse.json({
      verified: true,
      paymentStatus: session.payment_status,
      amount: actualAmount,
      donationUpdated,
      donationId: updatedDonationId,
      message: donationUpdated ? "Donation status updated to completed" : "Donation already completed or not found"
    })
  } catch (error: any) {
    console.error("[Verify Session] Error:", error)
    return NextResponse.json(
      { error: "Failed to verify session", details: error.message },
      { status: 500 }
    )
  }
}

