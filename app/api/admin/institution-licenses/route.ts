import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireAdminId } from "@/lib/admin-api-auth"
import { ensureInstitutionSchema } from "@/lib/ensure-institution-schema"
import { recordInstitutionAudit } from "@/lib/institutions/audit"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const auth = await requireAdminId(request)
  if (!auth.ok) return auth.response
  await ensureInstitutionSchema()
  const licenses = await sql`
    SELECT l.*, u.name AS institution_name
    FROM institution_licenses l
    JOIN universities u ON u.id = l.institution_id
    ORDER BY l.created_at DESC
    LIMIT 200
  `
  return NextResponse.json({ licenses })
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminId(request)
  if (!auth.ok) return auth.response
  await ensureInstitutionSchema()
  const body = await request.json().catch(() => ({}))
  const institutionId = Number(body.institutionId)
  if (!Number.isFinite(institutionId)) {
    return NextResponse.json({ error: "institutionId required" }, { status: 400 })
  }
  const rows = await sql`
    INSERT INTO institution_invoices (
      institution_id, license_id, quote_id, invoice_number, po_number, issue_date, due_date,
      amount_cents, payment_status, payment_reference, document_url
    ) VALUES (
      ${institutionId},
      ${body.licenseId ? Number(body.licenseId) : null},
      ${body.quoteId ? Number(body.quoteId) : null},
      ${body.invoiceNumber ? String(body.invoiceNumber) : null},
      ${body.poNumber ? String(body.poNumber) : null},
      ${body.issueDate ? String(body.issueDate) : null},
      ${body.dueDate ? String(body.dueDate) : null},
      ${Number(body.amountCents ?? 0)},
      ${body.paymentStatus ? String(body.paymentStatus) : "pending"},
      ${body.paymentReference ? String(body.paymentReference) : null},
      ${body.documentUrl ? String(body.documentUrl) : null}
    )
    RETURNING id
  `
  await recordInstitutionAudit({
    institutionId,
    actorUserType: "admin",
    actorUserId: Number(auth.adminId),
    action: "invoice_marked_paid",
    entityType: "institution_invoice",
    entityId: Number(rows[0].id),
    newValue: { paymentStatus: body.paymentStatus ?? "pending" },
    reason: "invoice_created",
  })
  return NextResponse.json({ success: true, invoiceId: rows[0].id })
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdminId(request)
  if (!auth.ok) return auth.response
  const body = await request.json().catch(() => ({}))
  const invoiceId = Number(body.invoiceId)
  if (!Number.isFinite(invoiceId)) return NextResponse.json({ error: "invoiceId required" }, { status: 400 })
  await sql`
    UPDATE institution_invoices
    SET payment_status = ${String(body.paymentStatus ?? "paid")},
        payment_date = COALESCE(${body.paymentDate ? String(body.paymentDate) : null}::date, CURRENT_DATE),
        payment_reference = COALESCE(${body.paymentReference ? String(body.paymentReference) : null}, payment_reference),
        updated_at = NOW()
    WHERE id = ${invoiceId}
  `
  const row = await sql`SELECT institution_id FROM institution_invoices WHERE id = ${invoiceId} LIMIT 1`
  await recordInstitutionAudit({
    institutionId: row[0] ? Number(row[0].institution_id) : null,
    actorUserType: "admin",
    actorUserId: Number(auth.adminId),
    action: "invoice_marked_paid",
    entityType: "institution_invoice",
    entityId: invoiceId,
    newValue: { paymentStatus: body.paymentStatus ?? "paid" },
  })
  return NextResponse.json({ success: true })
}
