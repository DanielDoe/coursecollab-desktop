import { sql } from "@/lib/db"
import { ensureInstitutionSchema } from "@/lib/ensure-institution-schema"
import { getActiveInstitutionLicense, listInstitutionLicenses } from "@/lib/institutions/licenses"
import { getInstitutionPlan } from "@/lib/institution-plans"
import { daysUntil } from "@/lib/institutions/metrics/scope"
import { recordInstitutionAudit } from "@/lib/institutions/audit"

function centsToDisplay(cents: number | null | undefined): string | null {
  if (cents == null || !Number.isFinite(Number(cents))) return null
  return `$${(Number(cents) / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

export async function getInstitutionBillingModule(institutionId: number) {
  await ensureInstitutionSchema()
  const license = await getActiveInstitutionLicense(institutionId)
  const plan = license ? getInstitutionPlan(String(license.plan_id)) : null
  const inst = await sql`SELECT name, legal_name FROM universities WHERE id = ${institutionId} LIMIT 1`

  const audit = await sql`
    SELECT action, created_at, new_value
    FROM institution_audit_logs
    WHERE institution_id = ${institutionId}
      AND action IN ('license_activated', 'license_modified', 'cora_credits_modified')
    ORDER BY created_at DESC
    LIMIT 20
  `

  return {
    summary: {
      planName: plan?.displayName ?? (license ? String(license.plan_id) : null),
      annualContractValue: centsToDisplay(license?.negotiated_price_cents ?? license?.list_price_cents),
      billingMethod: license ? String(license.billing_method) : null,
      paymentTerms: license?.billing_method === "invoice" ? "Net 30" : null,
      contractStatus: license ? String(license.contract_status) : null,
      renewalDate: license?.end_date ? String(license.end_date).slice(0, 10) : null,
      daysRemaining: daysUntil(license?.end_date ? String(license.end_date) : null),
    },
    contract: license
      ? {
          id: Number(license.id),
          startDate: license.start_date ? String(license.start_date).slice(0, 10) : null,
          endDate: license.end_date ? String(license.end_date).slice(0, 10) : null,
          termMonths: Number(license.contract_term_months ?? 12),
          planId: String(license.plan_id),
          listPrice: centsToDisplay(license.list_price_cents),
          negotiatedPrice: centsToDisplay(license.negotiated_price_cents),
          poNumber: license.purchase_order_id ? String(license.purchase_order_id) : null,
        }
      : null,
    institutionName: String(inst[0]?.name ?? ""),
    legalName: inst[0]?.legal_name ? String(inst[0].legal_name) : null,
    history: audit.map((a) => ({
      action: String(a.action),
      at: String(a.created_at),
    })),
  }
}

export async function getInstitutionInvoicesModule(institutionId: number) {
  await ensureInstitutionSchema()
  const invoices = await sql`
    SELECT * FROM institution_invoices
    WHERE institution_id = ${institutionId}
    ORDER BY COALESCE(issue_date, created_at) DESC
  `

  const totalCents = invoices.reduce((s, inv) => s + Number(inv.amount_cents ?? 0), 0)
  const paidCents = invoices
    .filter((inv) => String(inv.payment_status).toLowerCase() === "paid")
    .reduce((s, inv) => s + Number(inv.amount_cents ?? 0), 0)
  const outstandingCents = totalCents - paidCents
  const nextDue = invoices.find((inv) => {
    const st = String(inv.payment_status).toLowerCase()
    return st !== "paid" && st !== "void"
  })

  return {
    kpis: {
      totalInvoiced: centsToDisplay(totalCents),
      amountPaid: centsToDisplay(paidCents),
      outstanding: centsToDisplay(outstandingCents),
      nextDueDate: nextDue?.due_date ? String(nextDue.due_date).slice(0, 10) : null,
    },
    invoices: invoices.map((inv) => ({
      id: Number(inv.id),
      number: inv.invoice_number ? String(inv.invoice_number) : `#${inv.id}`,
      issueDate: inv.issue_date ? String(inv.issue_date).slice(0, 10) : null,
      description: inv.po_number ? `PO ${inv.po_number}` : "Institutional license",
      poNumber: inv.po_number ? String(inv.po_number) : null,
      amountCents: Number(inv.amount_cents ?? 0),
      amount: centsToDisplay(Number(inv.amount_cents ?? 0)),
      dueDate: inv.due_date ? String(inv.due_date).slice(0, 10) : null,
      status: String(inv.payment_status),
      paymentDate: inv.payment_date ? String(inv.payment_date).slice(0, 10) : null,
      documentUrl: inv.document_url ? String(inv.document_url) : null,
    })),
  }
}

export async function getInstitutionSettingsModule(institutionId: number) {
  await ensureInstitutionSchema()
  const inst = await sql`
    SELECT id, name, legal_name, domain, institution_type, website, logo_url, status
    FROM universities WHERE id = ${institutionId} LIMIT 1
  `
  const admins = await sql`
    SELECT m.id, m.role, m.email, m.status, m.joined_at, i.name
    FROM institution_members m
    LEFT JOIN instructors i ON m.user_type = 'instructor' AND i.id = m.user_id
    WHERE m.institution_id = ${institutionId}
      AND m.role IN ('owner', 'institution_admin', 'academic_admin', 'billing_admin', 'department_admin')
      AND m.removed_at IS NULL
    ORDER BY m.role, m.email
  `
  const allowance = await sql`
    SELECT warning_thresholds, hard_limit FROM institution_cora_allowances a
    JOIN institution_licenses l ON l.id = a.license_id
    WHERE l.institution_id = ${institutionId} AND l.status = 'active'
    LIMIT 1
  `

  const row = inst[0]
  return {
    general: row
      ? {
          displayName: String(row.name),
          legalName: row.legal_name ? String(row.legal_name) : null,
          domain: row.domain ? String(row.domain) : null,
          institutionType: String(row.institution_type ?? "university"),
          website: row.website ? String(row.website) : null,
          logoUrl: row.logo_url ? String(row.logo_url) : null,
        }
      : null,
    administrators: admins.map((a) => ({
      id: Number(a.id),
      name: a.name ? String(a.name) : a.email ? String(a.email) : "Admin",
      email: a.email ? String(a.email) : null,
      role: String(a.role),
      status: String(a.status),
      lastActive: a.joined_at ? String(a.joined_at).slice(0, 10) : null,
    })),
    cora: {
      warningThresholds: allowance[0]?.warning_thresholds ?? [70, 85, 95],
      hardLimit: allowance[0]?.hard_limit ?? true,
    },
    sections: ["general", "administrators", "cora", "notifications"] as const,
  }
}

export async function updateInstitutionGeneral(
  institutionId: number,
  input: { website?: string; timezone?: string },
  actorUserId?: number,
) {
  await ensureInstitutionSchema()
  await sql`
    UPDATE universities
    SET website = COALESCE(${input.website ?? null}, website),
        updated_at = NOW()
    WHERE id = ${institutionId}
  `
  await recordInstitutionAudit({
    institutionId,
    actorUserId: actorUserId ?? null,
    action: "settings_updated",
    entityType: "university",
    entityId: institutionId,
    newValue: input,
  })
}
