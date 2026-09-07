import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { stripe } from "@/lib/stripe"

export const dynamic = "force-dynamic"

/** GET: Fetch purchase history for the logged-in student (from Stripe invoices) */
export async function GET(request: NextRequest) {
  try {
    const studentId = request.nextUrl.searchParams.get("studentId")
    if (!studentId) {
      return NextResponse.json({ error: "Student ID required" }, { status: 400 })
    }

    const students = await sql`
      SELECT id, stripe_customer_id, full_name, email
      FROM students
      WHERE id = ${parseInt(studentId)}
      LIMIT 1
    `
    if (students.length === 0) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 })
    }

    const student = students[0]
    const customerId = student.stripe_customer_id

    if (!customerId || !stripe) {
      return NextResponse.json({
        purchases: [],
        subscriptions: [],
        message: customerId ? "Payment data unavailable" : "No payment history yet",
      })
    }

    const [invoicesRes, chargesRes, subscriptionsRes] = await Promise.all([
      stripe.invoices.list({ customer: customerId, limit: 100, status: "paid" }),
      stripe.charges.list({ customer: customerId, limit: 100 }),
      stripe.subscriptions.list({ customer: customerId, status: "all", limit: 50, expand: ["data.items.data.price"] }),
    ])

    const invoices = invoicesRes.data
    const subscriptions = subscriptionsRes.data
    const charges = chargesRes.data.filter((c) => c.paid && c.status === "succeeded")

    const REFUND_WINDOW_DAYS = 7
    const now = Date.now()

    // Fetch existing refund requests for this student (by invoice or charge)
    let refundRequests: { stripe_invoice_id: string | null; stripe_charge_id: string | null; status: string }[] = []
    try {
      const tableCheck = await sql`
        SELECT 1 FROM information_schema.tables WHERE table_name = 'refund_requests' LIMIT 1
      `
      if (tableCheck.length > 0) {
        const rows = await sql`
          SELECT stripe_invoice_id, stripe_charge_id, status FROM refund_requests
          WHERE student_id = ${student.id}
        `
        refundRequests = rows
      }
    } catch {
      // Table might not exist
    }

    const invoiceChargeIds = new Set(
      invoices
        .map((inv) => (typeof inv.charge === "string" ? inv.charge : inv.charge?.id))
        .filter(Boolean)
    )

    // Build purchases from invoices (subscription payments)
    const purchases: Array<{
      id: string
      chargeId?: string
      amount: number
      amountCents: number
      currency: string
      status: string
      paidAt: string
      description: string
      invoicePdf?: string
      hostedInvoiceUrl?: string
      subscriptionId?: string
      canRequestRefund: boolean
      refundWindowDays: number
      refundRequestStatus: string | null
    }> = invoices.map((inv) => {
      const paidAt = inv.status_transitions?.paid_at
        ? new Date(inv.status_transitions.paid_at * 1000)
        : new Date(inv.created * 1000)
      const daysSincePurchase = (now - paidAt.getTime()) / (1000 * 60 * 60 * 24)
      const existingRefund =
        refundRequests.find((r) => r.stripe_invoice_id === inv.id) ||
        refundRequests.find(
          (r) => r.stripe_charge_id === (typeof inv.charge === "string" ? inv.charge : inv.charge?.id)
        )
      const canRequestRefund =
        daysSincePurchase <= REFUND_WINDOW_DAYS &&
        !existingRefund &&
        inv.amount_paid > 0

      return {
        id: inv.id,
        chargeId: typeof inv.charge === "string" ? inv.charge : inv.charge?.id,
        amount: inv.amount_paid / 100,
        amountCents: inv.amount_paid,
        currency: inv.currency,
        status: inv.status,
        paidAt: paidAt.toISOString(),
        description: inv.description || (inv.lines?.data?.[0]?.description ?? "Membership payment"),
        invoicePdf: inv.invoice_pdf ?? undefined,
        hostedInvoiceUrl: inv.hosted_invoice_url ?? undefined,
        subscriptionId: inv.subscription ?? undefined,
        canRequestRefund,
        refundWindowDays: REFUND_WINDOW_DAYS,
        refundRequestStatus: existingRefund?.status ?? null,
      }
    })

    // Add one-time payments (charges without invoices) - e.g. semester plans
    for (const ch of charges) {
      if (invoiceChargeIds.has(ch.id)) continue // Already covered by invoice
      const paidAt = new Date(ch.created * 1000)
      const daysSincePurchase = (now - paidAt.getTime()) / (1000 * 60 * 60 * 24)
      const existingRefund =
        refundRequests.find((r) => r.stripe_charge_id === ch.id) ||
        refundRequests.find((r) => r.stripe_invoice_id === ch.id)
      const canRequestRefund =
        daysSincePurchase <= REFUND_WINDOW_DAYS && !existingRefund && ch.amount > 0

      purchases.push({
        id: ch.id,
        chargeId: ch.id,
        amount: ch.amount / 100,
        amountCents: ch.amount,
        currency: ch.currency,
        status: ch.status,
        paidAt: paidAt.toISOString(),
        description: ch.description || ch.metadata?.planId
          ? `${ch.metadata?.planId || "Membership"} (one-time)`
          : "Membership payment (one-time)",
        invoicePdf: undefined,
        hostedInvoiceUrl: undefined,
        subscriptionId: undefined,
        canRequestRefund,
        refundWindowDays: REFUND_WINDOW_DAYS,
        refundRequestStatus: existingRefund?.status ?? null,
      })
    }

    // Sort by paid date descending
    purchases.sort(
      (a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime()
    )

    // Build subscriptions list (active + recently canceled for visibility)
    const { STRIPE_PRODUCTS } = await import("@/lib/stripe")
    const subscriptionItems = subscriptions.map((sub) => {
      const price = sub.items.data[0]?.price
      const amount = price?.unit_amount ? price.unit_amount / 100 : 0
      let planName = "Membership"
      if (price?.id === STRIPE_PRODUCTS.Trailblazer) planName = "Trailblazer"
      else if (price?.id === STRIPE_PRODUCTS.Explorer) planName = "Explorer"

      return {
        id: sub.id,
        status: sub.status,
        planName,
        amount,
        currency: price?.currency ?? "usd",
        currentPeriodEnd: new Date(sub.current_period_end * 1000).toISOString(),
        cancelAtPeriodEnd: sub.cancel_at_period_end,
        created: new Date(sub.created * 1000).toISOString(),
      }
    })

    return NextResponse.json({ purchases, subscriptions: subscriptionItems })
  } catch (error: any) {
    console.error("[Purchases] Error:", error?.message)
    return NextResponse.json(
      { error: error?.message || "Failed to fetch purchases" },
      { status: 500 }
    )
  }
}
