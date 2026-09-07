import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { createNotification } from "@/lib/create-notification"

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Send reminder notifications to students with pending donations
 * Only sends reminders for donations that have been pending for more than 1 hour
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { studentId, donationId } = body // Optional filters

    console.log(`[Send Reminders] Sending reminder notifications for pending donations`)

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

    // Get pending donations that are at least 1 hour old
    let pendingDonations
    if (donationId) {
      // Send reminder for specific donation
      pendingDonations = hasDeletedAtColumn
        ? await sql`
            SELECT 
              d.id,
              d.student_id,
              d.amount,
              d.transaction_id,
              d.created_at,
              s.full_name as student_name
            FROM donations d
            LEFT JOIN students s ON d.student_id = s.id
            WHERE d.id = ${parseInt(donationId)}
              AND d.status = 'pending'
              AND d.created_at <= NOW() - INTERVAL '1 hour'
              AND d.deleted_at IS NULL
            LIMIT 1
          `
        : await sql`
            SELECT 
              d.id,
              d.student_id,
              d.amount,
              d.transaction_id,
              d.created_at,
              s.full_name as student_name
            FROM donations d
            LEFT JOIN students s ON d.student_id = s.id
            WHERE d.id = ${parseInt(donationId)}
              AND d.status = 'pending'
              AND d.created_at <= NOW() - INTERVAL '1 hour'
            LIMIT 1
          `
    } else if (studentId) {
      // Send reminders for all pending donations for a student
      pendingDonations = hasDeletedAtColumn
        ? await sql`
            SELECT 
              d.id,
              d.student_id,
              d.amount,
              d.transaction_id,
              d.created_at,
              s.full_name as student_name
            FROM donations d
            LEFT JOIN students s ON d.student_id = s.id
            WHERE d.student_id = ${parseInt(studentId)}
              AND d.status = 'pending'
              AND d.created_at <= NOW() - INTERVAL '1 hour'
              AND d.deleted_at IS NULL
            ORDER BY d.created_at DESC
          `
        : await sql`
            SELECT 
              d.id,
              d.student_id,
              d.amount,
              d.transaction_id,
              d.created_at,
              s.full_name as student_name
            FROM donations d
            LEFT JOIN students s ON d.student_id = s.id
            WHERE d.student_id = ${parseInt(studentId)}
              AND d.status = 'pending'
              AND d.created_at <= NOW() - INTERVAL '1 hour'
            ORDER BY d.created_at DESC
          `
    } else {
      // Send reminders for all pending donations older than 1 hour
      pendingDonations = hasDeletedAtColumn
        ? await sql`
            SELECT 
              d.id,
              d.student_id,
              d.amount,
              d.transaction_id,
              d.created_at,
              s.full_name as student_name
            FROM donations d
            LEFT JOIN students s ON d.student_id = s.id
            WHERE d.status = 'pending'
              AND d.created_at <= NOW() - INTERVAL '1 hour'
              AND d.created_at >= NOW() - INTERVAL '7 days'
              AND d.deleted_at IS NULL
            ORDER BY d.created_at DESC
            LIMIT 50
          `
        : await sql`
            SELECT 
              d.id,
              d.student_id,
              d.amount,
              d.transaction_id,
              d.created_at,
              s.full_name as student_name
            FROM donations d
            LEFT JOIN students s ON d.student_id = s.id
            WHERE d.status = 'pending'
              AND d.created_at <= NOW() - INTERVAL '1 hour'
              AND d.created_at >= NOW() - INTERVAL '7 days'
            ORDER BY d.created_at DESC
            LIMIT 50
          `
    }

    if (pendingDonations.length === 0) {
      return NextResponse.json({
        sent: 0,
        message: "No pending donations found that need reminders"
      })
    }

    console.log(`[Send Reminders] Found ${pendingDonations.length} pending donation(s) to send reminders for`)

    let sentCount = 0
    const errors: any[] = []

    for (const donation of pendingDonations) {
      try {
        const hoursPending = (Date.now() - new Date(donation.created_at).getTime()) / (1000 * 60 * 60)
        
        await createNotification({
          studentId: donation.student_id,
          type: "donation",
          title: "Complete Your Donation",
          message: `Your donation of $${parseFloat(donation.amount.toString()).toFixed(2)} is still pending. Please complete your payment to support CourseCollab development.`,
          link: "/student/donate"
        })
        
        sentCount++
        console.log(`[Send Reminders] ✅ Sent reminder to student ${donation.student_id} for donation ${donation.id} (pending for ${hoursPending.toFixed(1)} hours)`)
      } catch (error: any) {
        console.error(`[Send Reminders] ❌ Failed to send reminder for donation ${donation.id}:`, error.message)
        errors.push({
          donationId: donation.id,
          studentId: donation.student_id,
          error: error.message
        })
      }
    }

    return NextResponse.json({
      sent: sentCount,
      total: pendingDonations.length,
      errors: errors.length > 0 ? errors : undefined,
      message: `Sent ${sentCount} reminder notification(s)`
    })
  } catch (error: any) {
    console.error("[Send Reminders] Error:", error)
    return NextResponse.json(
      { error: "Failed to send reminder notifications", details: error.message },
      { status: 500 }
    )
  }
}

