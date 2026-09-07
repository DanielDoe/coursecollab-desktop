import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

export const dynamic = "force-dynamic"

const REFUND_WINDOW_DAYS = 7

/** POST: Student submits a refund request */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { studentId, stripeInvoiceId, stripeChargeId, amountCents, reason } = body

    if (!studentId || (!stripeInvoiceId && !stripeChargeId)) {
      return NextResponse.json(
        { error: "Student ID and invoice or charge ID required" },
        { status: 400 }
      )
    }

    const invoiceOrChargeId = stripeInvoiceId || stripeChargeId

    const studentIdNum = parseInt(studentId)
    if (isNaN(studentIdNum)) {
      return NextResponse.json({ error: "Invalid student ID" }, { status: 400 })
    }

    // Verify student exists
    const students = await sql`
      SELECT id FROM students WHERE id = ${studentIdNum} LIMIT 1
    `
    if (students.length === 0) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 })
    }

    // Check if refund request already exists (by invoice or charge)
    const existing = await sql`
      SELECT id, status FROM refund_requests
      WHERE student_id = ${studentIdNum}
        AND (stripe_invoice_id = ${invoiceOrChargeId} OR stripe_charge_id = ${invoiceOrChargeId})
      LIMIT 1
    `
    if (existing.length > 0) {
      const status = existing[0].status
      if (status === "pending") {
        return NextResponse.json(
          { error: "Refund request already submitted for this purchase" },
          { status: 400 }
        )
      }
      if (status === "refunded" || status === "approved") {
        return NextResponse.json(
          { error: "This purchase has already been refunded" },
          { status: 400 }
        )
      }
    }

    const amount = amountCents ?? 0
    if (amount <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 })
    }

    await sql`
      INSERT INTO refund_requests (
        student_id,
        stripe_invoice_id,
        stripe_charge_id,
        amount_cents,
        reason,
        status
      )
      VALUES (
        ${studentIdNum},
        ${stripeInvoiceId || null},
        ${stripeChargeId || invoiceOrChargeId},
        ${amount},
        ${reason || null},
        'pending'
      )
    `

    return NextResponse.json({
      success: true,
      message:
        "Refund request submitted. We'll review it within 1-2 business days. You'll receive an email if approved.",
    })
  } catch (error: any) {
    console.error("[Refund Request] Error:", error?.message)
    return NextResponse.json(
      { error: error?.message || "Failed to submit refund request" },
      { status: 500 }
    )
  }
}
