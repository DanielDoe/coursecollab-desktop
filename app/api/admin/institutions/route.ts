import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireAdminId } from "@/lib/admin-api-auth"
import { ensureInstitutionSchema } from "@/lib/ensure-institution-schema"
import { getInstitutionPlan } from "@/lib/institution-plans"
import { activateInstitutionLicense, createInstitutionLicense, setLicenseCourseScopes, suspendInstitutionLicense } from "@/lib/institutions/licenses"
import { recordInstitutionAudit } from "@/lib/institutions/audit"
import { grantInstitutionCoraCredits } from "@/lib/institutions/cora"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const auth = await requireAdminId(request)
  if (!auth.ok) return auth.response
  await ensureInstitutionSchema()
  const institutions = await sql`
    SELECT id, name, slug, domain, institution_type, status, created_at
    FROM universities
    ORDER BY name
  `
  const requests = await sql`
    SELECT id, institution_name, contact_name, contact_email, desired_plan, request_kind, status, created_at
    FROM institution_access_requests
    ORDER BY created_at DESC
    LIMIT 50
  `
  return NextResponse.json({ institutions, requests })
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminId(request)
  if (!auth.ok) return auth.response
  await ensureInstitutionSchema()
  const body = await request.json().catch(() => ({}))
  const name = String(body.name ?? "").trim()
  if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 })
  const slug = String(body.slug ?? name).toLowerCase().replace(/[^a-z0-9]+/g, "-")
  const shortName = String(body.shortName ?? slug.slice(0, 12)).toUpperCase()
  const rows = await sql`
    INSERT INTO universities (name, short_name, slug, domain, institution_type, status, legal_name)
    VALUES (
      ${name},
      ${shortName},
      ${slug},
      ${body.domain ? String(body.domain) : null},
      ${body.institutionType ? String(body.institutionType) : "university"},
      'pending',
      ${body.legalName ? String(body.legalName) : null}
    )
    RETURNING id
  `
  await recordInstitutionAudit({
    institutionId: Number(rows[0].id),
    actorUserType: "admin",
    actorUserId: Number(auth.adminId),
    action: "institution_admin_added",
    entityType: "university",
    entityId: Number(rows[0].id),
    newValue: { name },
  })
  return NextResponse.json({ success: true, id: rows[0].id })
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdminId(request)
  if (!auth.ok) return auth.response
  await ensureInstitutionSchema()
  const body = await request.json().catch(() => ({}))
  const action = String(body.action ?? "")
  const licenseId = Number(body.licenseId)
  const actor = { actorUserType: "admin" as const, actorUserId: Number(auth.adminId) }

  if (action === "activate_license" && Number.isFinite(licenseId)) {
    await activateInstitutionLicense({ licenseId, ...actor, reason: String(body.reason ?? "admin_activation") })
    const courseIds = Array.isArray(body.courseIds) ? body.courseIds.map(Number).filter(Number.isFinite) : []
    if (courseIds.length) await setLicenseCourseScopes(licenseId, courseIds)
    return NextResponse.json({ success: true })
  }
  if (action === "suspend_license" && Number.isFinite(licenseId)) {
    await suspendInstitutionLicense({ licenseId, ...actor, reason: String(body.reason ?? "admin_suspend") })
    return NextResponse.json({ success: true })
  }
  if (action === "grant_cora" && Number.isFinite(licenseId)) {
    await grantInstitutionCoraCredits({
      licenseId,
      credits: Number(body.credits ?? 0),
      actorUserId: Number(auth.adminId),
      reason: String(body.reason ?? "admin_grant"),
    })
    return NextResponse.json({ success: true })
  }
  if (action === "create_license") {
    const institutionId = Number(body.institutionId)
    const plan = getInstitutionPlan(String(body.planId ?? "program"))
    if (!Number.isFinite(institutionId) || !plan) {
      return NextResponse.json({ error: "institutionId and planId required" }, { status: 400 })
    }
    const start = body.startDate ? String(body.startDate) : undefined
    const end = body.endDate ? String(body.endDate) : undefined
    const newId = await createInstitutionLicense({
      institutionId,
      planId: plan.id,
      startDate: start,
      endDate: end,
      billingMethod: body.billingMethod ? String(body.billingMethod) : "manual",
      contractStatus: body.contractStatus ? String(body.contractStatus) : "pending_payment",
      discountType: body.discountType ? String(body.discountType) : null,
      discountValue: body.discountValue != null ? Number(body.discountValue) : null,
      customPriceCents: body.negotiatedPriceCents != null ? Number(body.negotiatedPriceCents) : null,
      discountReason: body.discountReason ? String(body.discountReason) : null,
      foundingPartner: body.foundingPartner === true,
      contractTermMonths: body.contractTermMonths != null ? Number(body.contractTermMonths) : 12,
    })
    const courseIds = Array.isArray(body.courseIds) ? body.courseIds.map(Number).filter(Number.isFinite) : []
    if (courseIds.length) await setLicenseCourseScopes(newId, courseIds)
    if (body.activate === true) {
      await activateInstitutionLicense({ licenseId: newId, ...actor, reason: "admin_create_activate" })
    }
    await recordInstitutionAudit({
      institutionId,
      ...actor,
      action: "license_modified",
      entityType: "institution_license",
      entityId: newId,
      newValue: { planId: plan.id, courseIds },
    })
    return NextResponse.json({ success: true, licenseId: newId })
  }

  if (action === "add_member") {
    const institutionId = Number(body.institutionId)
    const email = String(body.email ?? "").trim().toLowerCase()
    const role = String(body.role ?? "institution_admin")
    const userType = String(body.userType ?? "instructor")
    const userId = Number(body.userId)
    if (!Number.isFinite(institutionId) || !email || !Number.isFinite(userId)) {
      return NextResponse.json({ error: "institutionId, email, and userId required" }, { status: 400 })
    }
    await sql`
      INSERT INTO institution_members (
        institution_id, user_type, user_id, role, status, email, invited_at, joined_at
      ) VALUES (
        ${institutionId}, ${userType}, ${userId}, ${role}, 'active', ${email}, NOW(), NOW()
      )
      ON CONFLICT (institution_id, user_type, user_id) DO UPDATE SET
        role = EXCLUDED.role,
        status = 'active',
        removed_at = NULL,
        email = EXCLUDED.email,
        updated_at = NOW()
    `
    await recordInstitutionAudit({
      institutionId,
      actorUserType: "admin",
      actorUserId: Number(auth.adminId),
      action: "institution_admin_added",
      entityType: "institution_member",
      newValue: { email, role, userType, userId },
    })
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 })
}
