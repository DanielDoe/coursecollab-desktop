import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { ensureInstitutionSchema } from "@/lib/ensure-institution-schema"
import { getInstitutionPlan, INSTITUTION_PLANS } from "@/lib/institution-plans"
import { checkRateLimit, rateLimitKey } from "@/lib/compliance/rate-limit"

export const dynamic = "force-dynamic"

export async function GET() {
  return NextResponse.json({
    plans: INSTITUTION_PLANS.filter((p) => p.active).map((p) => ({
      id: p.planKey,
      planKey: p.planKey,
      displayName: p.displayName,
      description: p.description,
      studentCapacity: p.studentCapacity,
      instructorCapacity: p.instructorCapacity,
      selfServiceEligible: p.selfServiceEligible,
      quoteOnly: p.quoteOnly,
      billingMode: p.billingMode,
      annualListPriceCents: p.annualListPriceCents,
      supportLevel: p.supportLevel,
      ctaLabel: p.ctaLabel,
      ctaHref: p.ctaHref,
      recommended: p.recommended === true,
      pricePresentation: p.pricePresentation,
    })),
  })
}

export async function POST(request: NextRequest) {
  const limited = checkRateLimit(rateLimitKey(request, "institution-request"), 8, 60_000)
  if (!limited.ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 })
  }
  await ensureInstitutionSchema()
  const body = await request.json().catch(() => ({}))
  const institutionName = String(body.institutionName ?? "").trim()
  const contactName = String(body.contactName ?? "").trim()
  const contactEmail = String(body.contactEmail ?? "").trim().toLowerCase()
  const requestKind = String(body.requestKind ?? "demo")
  if (!institutionName || !contactName || !contactEmail.includes("@")) {
    return NextResponse.json({ error: "Institution name, contact name, and email are required" }, { status: 400 })
  }
  if (!["demo", "quote", "pilot"].includes(requestKind)) {
    return NextResponse.json({ error: "Invalid request kind" }, { status: 400 })
  }
  const desiredPlan = body.desiredPlan ? getInstitutionPlan(String(body.desiredPlan)) : null
  if (body.desiredPlan && !desiredPlan) {
    return NextResponse.json({ error: "Unknown institution plan" }, { status: 400 })
  }
  const estimatedStudents = body.estimatedStudents === "" || body.estimatedStudents == null ? null : Number(body.estimatedStudents)
  const estimatedInstructors = body.estimatedInstructors === "" || body.estimatedInstructors == null ? null : Number(body.estimatedInstructors)
  const rows = await sql`
    INSERT INTO institution_access_requests (
      institution_name, domain, institution_type, contact_name, contact_email, job_title,
      department, phone, estimated_students, estimated_instructors, desired_scope, desired_plan, request_kind
    ) VALUES (
      ${institutionName},
      ${body.domain ? String(body.domain) : null},
      ${body.institutionType ? String(body.institutionType) : null},
      ${contactName},
      ${contactEmail},
      ${body.jobTitle ? String(body.jobTitle) : null},
      ${body.department ? String(body.department) : null},
      ${body.phone ? String(body.phone) : null},
      ${Number.isFinite(estimatedStudents) ? estimatedStudents : null},
      ${Number.isFinite(estimatedInstructors) ? estimatedInstructors : null},
      ${body.desiredScope ? String(body.desiredScope) : null},
      ${desiredPlan?.planKey ?? null},
      ${requestKind}
    )
    RETURNING id
  `
  const requestId = Number(rows[0]?.id)
  try {
    const { notifyInstitutionAccessRequest } = await import("@/lib/institutions/request-notify")
    await notifyInstitutionAccessRequest({
      requestId,
      requestKind,
      institutionName,
      contactName,
      contactEmail,
      desiredPlan: desiredPlan?.planKey ?? null,
      domain: body.domain ? String(body.domain) : null,
      jobTitle: body.jobTitle ? String(body.jobTitle) : null,
      department: body.department ? String(body.department) : null,
      phone: body.phone ? String(body.phone) : null,
      estimatedStudents: Number.isFinite(estimatedStudents) ? estimatedStudents : null,
      estimatedInstructors: Number.isFinite(estimatedInstructors) ? estimatedInstructors : null,
      desiredScope: body.desiredScope ? String(body.desiredScope) : null,
    })
  } catch (err) {
    console.error("[institutions/request] notify failed", err)
  }
  return NextResponse.json({ success: true, requestId })
}
