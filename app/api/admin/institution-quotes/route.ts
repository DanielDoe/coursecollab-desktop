import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireAdminId } from "@/lib/admin-api-auth"
import { ensureInstitutionSchema } from "@/lib/ensure-institution-schema"
import { recordInstitutionAudit } from "@/lib/institutions/audit"
import { getInstitutionPlan } from "@/lib/institution-plans"
import { applyInstitutionDiscount, snapshotPlanCommercialTerms, INSTITUTION_DISCOUNT_TYPES, type InstitutionDiscountType } from "@/lib/institutional-pricing"
import { activateInstitutionLicense, createInstitutionLicense } from "@/lib/institutions/licenses"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const auth = await requireAdminId(request)
  if (!auth.ok) return auth.response
  await ensureInstitutionSchema()
  const quotes = await sql`
    SELECT q.*, u.name AS institution_name
    FROM institution_quotes q
    LEFT JOIN universities u ON u.id = q.institution_id
    ORDER BY q.created_at DESC
    LIMIT 200
  `
  return NextResponse.json({ quotes })
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminId(request)
  if (!auth.ok) return auth.response
  await ensureInstitutionSchema()
  const body = await request.json().catch(() => ({}))
  const plan = getInstitutionPlan(String(body.planId ?? "program"))
  if (!plan) return NextResponse.json({ error: "Unknown plan" }, { status: 400 })

  const discountTypeRaw = body.discountType ? String(body.discountType) : "none"
  const discountType: InstitutionDiscountType | "none" =
    discountTypeRaw === "none" || INSTITUTION_DISCOUNT_TYPES.includes(discountTypeRaw as InstitutionDiscountType)
      ? (discountTypeRaw as InstitutionDiscountType | "none")
      : "none"
  if (discountTypeRaw !== "none" && discountType === "none") {
    return NextResponse.json({ error: "Invalid discount type" }, { status: 400 })
  }
  if (plan.annualListPriceCents == null && discountType !== "custom_price") {
    return NextResponse.json({ error: "Enterprise quotes require a custom_price" }, { status: 400 })
  }

  const listPriceCents = plan.annualListPriceCents
  const priced =
    listPriceCents != null
      ? applyInstitutionDiscount({
          listPriceCents,
          discountType: discountType === "none" ? "none" : discountType,
          discountValue: body.discountValue != null ? Number(body.discountValue) : 0,
          customPriceCents: body.negotiatedPriceCents != null ? Number(body.negotiatedPriceCents) : null,
        })
      : {
          listPriceCents: null as number | null,
          negotiatedPriceCents: body.negotiatedPriceCents != null ? Number(body.negotiatedPriceCents) : null,
          discountCents: 0,
        }

  const snap = snapshotPlanCommercialTerms(plan.planKey, {
    discountType: discountType === "none" ? "none" : discountType,
    discountValue: body.discountValue != null ? Number(body.discountValue) : null,
    customPriceCents: priced.negotiatedPriceCents,
    contractTermMonths: body.contractTermMonths != null ? Number(body.contractTermMonths) : 12,
  })

  const rows = await sql`
    INSERT INTO institution_quotes (
      institution_id, contact_email, contact_name, plan_id, seat_limit, scope,
      annual_price_cents, list_price_cents, negotiated_price_cents, setup_fee_cents, ai_allowance,
      discount_cents, discount_type, discount_value, discount_reason, approved_by, approval_date,
      pricing_version, contract_term_months, founding_partner, valid_until, status, notes, created_by
    ) VALUES (
      ${body.institutionId ? Number(body.institutionId) : null},
      ${body.contactEmail ? String(body.contactEmail) : null},
      ${body.contactName ? String(body.contactName) : null},
      ${snap.planId},
      ${snap.studentCapacity},
      ${JSON.stringify(body.scope ?? {})}::jsonb,
      ${priced.negotiatedPriceCents},
      ${priced.listPriceCents},
      ${priced.negotiatedPriceCents},
      ${Number(body.setupFeeCents ?? 0)},
      ${body.aiAllowance != null ? Number(body.aiAllowance) : snap.includedCoraCredits},
      ${priced.discountCents ?? 0},
      ${discountType === "none" ? null : discountType},
      ${body.discountValue != null ? Number(body.discountValue) : null},
      ${body.discountReason ? String(body.discountReason) : null},
      ${discountType !== "none" ? Number(auth.adminId) : null},
      ${discountType !== "none" ? new Date().toISOString().slice(0, 10) : null},
      ${snap.pricingVersion},
      ${snap.contractTermMonths},
      ${body.foundingPartner === true},
      ${body.validUntil ? String(body.validUntil) : null},
      ${body.status ? String(body.status) : "draft"},
      ${body.notes ? String(body.notes) : null},
      ${Number(auth.adminId)}
    )
    RETURNING id
  `
  await recordInstitutionAudit({
    institutionId: body.institutionId ? Number(body.institutionId) : null,
    actorUserType: "admin",
    actorUserId: Number(auth.adminId),
    action: "quote_created",
    entityType: "institution_quote",
    entityId: Number(rows[0].id),
    newValue: {
      planId: snap.planId,
      listPriceCents: priced.listPriceCents,
      negotiatedPriceCents: priced.negotiatedPriceCents,
      pricingVersion: snap.pricingVersion,
    },
    reason: "quote_created",
  })
  return NextResponse.json({ success: true, quoteId: rows[0].id })
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdminId(request)
  if (!auth.ok) return auth.response
  await ensureInstitutionSchema()
  const body = await request.json().catch(() => ({}))
  const quoteId = Number(body.quoteId)
  const status = String(body.status ?? "")
  if (!Number.isFinite(quoteId) || !status) {
    return NextResponse.json({ error: "quoteId and status required" }, { status: 400 })
  }
  const existing = await sql`SELECT * FROM institution_quotes WHERE id = ${quoteId} LIMIT 1`
  if (existing.length === 0) return NextResponse.json({ error: "Quote not found" }, { status: 404 })
  const quote = existing[0]

  await sql`
    UPDATE institution_quotes SET status = ${status}, updated_at = NOW() WHERE id = ${quoteId}
  `

  if (status === "accepted" && quote.institution_id && !quote.license_id) {
    const licenseId = await createInstitutionLicense({
      institutionId: Number(quote.institution_id),
      planId: String(quote.plan_id),
      billingMethod: "invoice",
      contractStatus: "accepted",
      quoteId,
      listPriceCents: quote.list_price_cents != null ? Number(quote.list_price_cents) : null,
      negotiatedPriceCents:
        quote.negotiated_price_cents != null
          ? Number(quote.negotiated_price_cents)
          : quote.annual_price_cents != null
            ? Number(quote.annual_price_cents)
            : null,
      pricingVersion: quote.pricing_version != null ? Number(quote.pricing_version) : null,
      includedCoraCredits: quote.ai_allowance != null ? Number(quote.ai_allowance) : null,
      studentCapacity: quote.seat_limit != null ? Number(quote.seat_limit) : null,
      discountType: quote.discount_type ? String(quote.discount_type) : quote.negotiated_price_cents != null ? "custom_price" : null,
      discountValue: quote.discount_value != null ? Number(quote.discount_value) : null,
      discountReason: quote.discount_reason ? String(quote.discount_reason) : null,
      foundingPartner: quote.founding_partner === true,
      contractTermMonths: quote.contract_term_months != null ? Number(quote.contract_term_months) : 12,
    })
    await sql`UPDATE institution_quotes SET license_id = ${licenseId}, updated_at = NOW() WHERE id = ${quoteId}`
    if (body.activate === true) {
      await activateInstitutionLicense({
        licenseId,
        actorUserType: "admin",
        actorUserId: Number(auth.adminId),
        reason: "quote_accepted",
      })
    }
  }

  return NextResponse.json({ success: true })
}
