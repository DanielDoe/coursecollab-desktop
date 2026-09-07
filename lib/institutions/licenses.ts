import { sql } from "@/lib/db"
import { ensureInstitutionSchema } from "@/lib/ensure-institution-schema"
import { recordInstitutionAudit } from "@/lib/institutions/audit"
import { getInstitutionPlan } from "@/lib/institution-plans"
import { snapshotPlanCommercialTerms } from "@/lib/institutional-pricing"
import { countActiveLearners, countUniqueCoveredRoster } from "@/lib/institutions/active-learners"

export async function listInstitutionLicenses(institutionId: number) {
  await ensureInstitutionSchema()
  return sql`
    SELECT l.*, u.name AS institution_name
    FROM institution_licenses l
    JOIN universities u ON u.id = l.institution_id
    WHERE l.institution_id = ${institutionId}
    ORDER BY l.created_at DESC
  `
}

export async function getActiveInstitutionLicense(institutionId: number) {
  await ensureInstitutionSchema()
  const rows = await sql`
    SELECT l.*, u.name AS institution_name
    FROM institution_licenses l
    JOIN universities u ON u.id = l.institution_id
    WHERE l.institution_id = ${institutionId}
      AND l.status = 'active'
      AND (l.end_date IS NULL OR l.end_date >= CURRENT_DATE)
    ORDER BY l.end_date DESC NULLS LAST
    LIMIT 1
  `
  return rows[0] ?? null
}

export async function activateInstitutionLicense(input: {
  licenseId: number
  actorUserType?: string
  actorUserId?: number
  reason?: string
}) {
  await ensureInstitutionSchema()
  const existing = await sql`SELECT * FROM institution_licenses WHERE id = ${input.licenseId} LIMIT 1`
  if (existing.length === 0) throw new Error("License not found")
  const prev = existing[0]
  await sql`
    UPDATE institution_licenses
    SET status = 'active',
        contract_status = 'active',
        updated_at = NOW()
    WHERE id = ${input.licenseId}
  `
  const snapCredits =
    prev.included_cora_credits != null
      ? Number(prev.included_cora_credits)
      : typeof getInstitutionPlan(String(prev.plan_id))?.includedCoraCredits === "number"
        ? Number(getInstitutionPlan(String(prev.plan_id))?.includedCoraCredits)
        : 0
  if (snapCredits > 0) {
    const existingAllowance = await sql`
      SELECT id FROM institution_cora_allowances WHERE license_id = ${input.licenseId} LIMIT 1
    `
    if (existingAllowance.length === 0) {
      await sql`
        INSERT INTO institution_cora_allowances (
          institution_id, license_id, included_credits, reset_date
        ) VALUES (
          ${prev.institution_id}, ${input.licenseId}, ${snapCredits},
          COALESCE(${prev.end_date ? String(prev.end_date).slice(0, 10) : null}::date, (CURRENT_DATE + INTERVAL '1 year')::date)
        )
      `
    }
  }
  await recordInstitutionAudit({
    institutionId: Number(prev.institution_id),
    actorUserType: input.actorUserType,
    actorUserId: input.actorUserId,
    action: "license_activated",
    entityType: "institution_license",
    entityId: input.licenseId,
    previousValue: { status: prev.status, contract_status: prev.contract_status },
    newValue: { status: "active", contract_status: "active" },
    reason: input.reason ?? null,
  })
}

export async function suspendInstitutionLicense(input: {
  licenseId: number
  actorUserType?: string
  actorUserId?: number
  reason?: string
}) {
  await ensureInstitutionSchema()
  const existing = await sql`SELECT * FROM institution_licenses WHERE id = ${input.licenseId} LIMIT 1`
  if (existing.length === 0) throw new Error("License not found")
  await sql`
    UPDATE institution_licenses
    SET status = 'suspended', contract_status = 'suspended', updated_at = NOW()
    WHERE id = ${input.licenseId}
  `
  await recordInstitutionAudit({
    institutionId: Number(existing[0].institution_id),
    actorUserType: input.actorUserType,
    actorUserId: input.actorUserId,
    action: "license_modified",
    entityType: "institution_license",
    entityId: input.licenseId,
    previousValue: { status: existing[0].status },
    newValue: { status: "suspended" },
    reason: input.reason ?? null,
  })
}

export async function setLicenseCourseScopes(licenseId: number, courseIds: number[]) {
  await ensureInstitutionSchema()
  await sql`DELETE FROM institution_license_scopes WHERE license_id = ${licenseId}`
  for (const courseId of courseIds) {
    if (!Number.isFinite(courseId) || courseId < 1) continue
    await sql`
      INSERT INTO institution_license_scopes (license_id, scope_type, course_id, scope_id)
      VALUES (${licenseId}, 'course', ${courseId}, ${courseId})
    `
  }
}

export async function countCoveredStudents(_institutionId: number, licenseId: number): Promise<number> {
  return countActiveLearners(licenseId)
}

export async function countCoveredRoster(licenseId: number): Promise<number> {
  return countUniqueCoveredRoster(licenseId)
}

export async function createInstitutionLicense(input: {
  institutionId: number
  planId: string
  billingMethod?: string
  contractStatus?: string
  status?: string
  startDate?: string
  endDate?: string
  quoteId?: number | null
  discountType?: string | null
  discountValue?: number | null
  customPriceCents?: number | null
  discountReason?: string | null
  foundingPartner?: boolean
  contractTermMonths?: number
  stripeSessionId?: string | null
  metadata?: Record<string, unknown>
  listPriceCents?: number | null
  negotiatedPriceCents?: number | null
  pricingVersion?: number | null
  includedCoraCredits?: number | null
  studentCapacity?: number | null
  instructorCapacity?: number | null
}): Promise<number> {
  await ensureInstitutionSchema()
  const snap = snapshotPlanCommercialTerms(input.planId, {
    discountType: input.discountType as "percentage" | "fixed_amount" | "custom_price" | "none" | null,
    discountValue: input.discountValue,
    customPriceCents: input.customPriceCents ?? input.negotiatedPriceCents,
    contractTermMonths: input.contractTermMonths,
  })
  const listPriceCents = input.listPriceCents !== undefined ? input.listPriceCents : snap.listPriceCents
  const negotiatedPriceCents =
    input.negotiatedPriceCents !== undefined ? input.negotiatedPriceCents : snap.negotiatedPriceCents
  const pricingVersion = input.pricingVersion ?? snap.pricingVersion
  const includedCoraCredits =
    input.includedCoraCredits !== undefined ? input.includedCoraCredits : snap.includedCoraCredits
  const studentCapacity = input.studentCapacity !== undefined ? input.studentCapacity : snap.studentCapacity
  const instructorCapacity =
    input.instructorCapacity !== undefined ? input.instructorCapacity : snap.instructorCapacity
  const start = input.startDate ?? new Date().toISOString().slice(0, 10)
  const endDate = input.endDate
    ? input.endDate
    : (() => {
        const d = new Date(start)
        d.setMonth(d.getMonth() + snap.contractTermMonths)
        return d.toISOString().slice(0, 10)
      })()
  const licenseYear = start.slice(0, 4)
  const rows = await sql`
    INSERT INTO institution_licenses (
      institution_id, plan_id, license_type, start_date, end_date, status, contract_status,
      billing_method, seat_limit_students, seat_limit_instructors, included_cora_credits,
      list_price_cents, negotiated_price_cents, discount_type, discount_value, discount_reason,
      pricing_version, billing_period, contract_term_months, license_year, founding_partner,
      quote_id, auto_renew, stripe_subscription_id, metadata
    ) VALUES (
      ${input.institutionId},
      ${snap.planId},
      ${snap.planId},
      ${start},
      ${endDate},
      ${input.status ?? "pending"},
      ${input.contractStatus ?? "pending_payment"},
      ${input.billingMethod ?? "manual"},
      ${studentCapacity},
      ${instructorCapacity},
      ${includedCoraCredits},
      ${listPriceCents},
      ${negotiatedPriceCents},
      ${input.discountType ?? null},
      ${input.discountValue ?? null},
      ${input.discountReason ?? null},
      ${pricingVersion},
      ${snap.billingPeriod},
      ${snap.contractTermMonths},
      ${licenseYear},
      ${input.foundingPartner === true},
      ${input.quoteId ?? null},
      false,
      ${input.stripeSessionId ?? null},
      ${JSON.stringify(input.metadata ?? {})}::jsonb
    )
    RETURNING id
  `
  return Number(rows[0].id)
}

export async function countCoveredInstructors(licenseId: number): Promise<number> {
  await ensureInstitutionSchema()
  const rows = await sql`
    SELECT COUNT(DISTINCT COALESCE(c.instructor_id, cs.instructor_id))::int AS n
    FROM institution_license_scopes s
    LEFT JOIN courses c ON c.id = s.course_id
    LEFT JOIN course_staff cs ON cs.course_id = s.course_id AND cs.is_active = true
    WHERE s.license_id = ${licenseId}
  `
  return Number(rows[0]?.n ?? 0)
}
