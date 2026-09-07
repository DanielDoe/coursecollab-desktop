import { type NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { sql } from "@/lib/db"
import { stripe } from "@/lib/stripe"

export const dynamic = "force-dynamic"

/** POST: Admin processes a refund (creates refund in Stripe, updates refund_request) */
export async function POST(request: NextRequest) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const body = await request.json()
    const { refundRequestId, chargeId, amountCents, reason } = body

    if (!refundRequestId && !chargeId) {
      return NextResponse.json(
        { error: "Refund request ID or charge ID required" },
        { status: 400 }
      )
    }

    if (!stripe) {
      return NextResponse.json(
        { error: "Stripe not configured" },
        { status: 503 }
      )
    }

    let chargeIdToRefund = chargeId
    let requestRecord: { id: number; student_id: number; stripe_charge_id: string | null; amount_cents: number } | null = null

    if (refundRequestId) {
      const rows = await sql`
        SELECT id, student_id, stripe_charge_id, stripe_invoice_id, amount_cents, status
        FROM refund_requests
        WHERE id = ${parseInt(refundRequestId)}
        LIMIT 1
      `
      if (rows.length === 0) {
        return NextResponse.json({ error: "Refund request not found" }, { status: 404 })
      }
      requestRecord = rows[0]
      if (requestRecord.status !== "pending") {
        return NextResponse.json(
          { error: `Refund request already ${requestRecord.status}` },
          { status: 400 }
        )
      }
      chargeIdToRefund = requestRecord.stripe_charge_id || chargeId
    }

    if (!chargeIdToRefund) {
      return NextResponse.json(
        { error: "Charge ID required for refund. Fetch from Stripe invoice if needed." },
        { status: 400 }
      )
    }

    const refund = await stripe.refunds.create({
      charge: chargeIdToRefund,
      amount: amountCents ?? requestRecord?.amount_cents,
      reason: reason || "requested_by_customer",
    })

    if (requestRecord) {
      await sql`
        UPDATE refund_requests
        SET status = 'refunded', updated_at = NOW(), processed_at = NOW()
        WHERE id = ${requestRecord.id}
      `
    }

    return NextResponse.json({
      success: true,
      refundId: refund.id,
      status: refund.status,
      message: "Refund processed successfully",
    })
  } catch (error: any) {
    console.error("[Admin Refund] Error:", error?.message)
    return NextResponse.json(
      { error: error?.message || "Failed to process refund" },
      { status: 500 }
    )
  }
}
