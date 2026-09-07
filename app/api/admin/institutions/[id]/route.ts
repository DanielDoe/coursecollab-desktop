import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireAdminId } from "@/lib/admin-api-auth"
import { ensureInstitutionSchema } from "@/lib/ensure-institution-schema"
import { getInstitutionOverview } from "@/lib/institutions/overview"
import { getActiveInstitutionLicense } from "@/lib/institutions/licenses"
import { buildInstitutionEconomics } from "@/lib/institutions/economics"

export const dynamic = "force-dynamic"

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminId(request)
  if (!auth.ok) return auth.response
  await ensureInstitutionSchema()
  const { id } = await context.params
  const institutionId = Number(id)
  if (!Number.isFinite(institutionId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }
  const overview = await getInstitutionOverview(institutionId)
  const members = await sql`
    SELECT id, user_type, user_id, role, status, email, joined_at
    FROM institution_members
    WHERE institution_id = ${institutionId}
    ORDER BY created_at DESC
  `
  const audit = await sql`
    SELECT action, entity_type, entity_id, reason, created_at, actor_user_type, actor_user_id
    FROM institution_audit_logs
    WHERE institution_id = ${institutionId}
    ORDER BY created_at DESC
    LIMIT 50
  `
  const usage = await sql`
    SELECT
      COALESCE(SUM(credits), 0)::int AS credits,
      COALESCE(SUM(estimated_cost_usd), 0)::numeric AS cost_usd
    FROM institution_cora_usage
    WHERE institution_id = ${institutionId}
  `
  const license = await getActiveInstitutionLicense(institutionId)
  const aiCostCents = Math.round(Number(usage[0]?.cost_usd ?? 0) * 100)
  const economics = buildInstitutionEconomics({
    negotiatedPriceCents: license?.negotiated_price_cents != null ? Number(license.negotiated_price_cents) : null,
    contractTermMonths: license?.contract_term_months != null ? Number(license.contract_term_months) : 12,
    activeStudents: overview?.utilization.activeStudents ?? 0,
    studentCapacity:
      overview?.license?.seatLimitStudents ??
      (license?.seat_limit_students != null ? Number(license.seat_limit_students) : null),
    includedCoraCredits: overview?.cora.included ?? 0,
    usedCoraCredits: Number(usage[0]?.credits ?? overview?.cora.used ?? 0),
    estimatedAiCostCents: aiCostCents,
  })
  return NextResponse.json({
    overview,
    members,
    audit,
    economics: {
      ...economics,
      coraCredits: Number(usage[0]?.credits ?? 0),
      estimatedCostUsd: Number(usage[0]?.cost_usd ?? 0),
      listPriceCents: license?.list_price_cents != null ? Number(license.list_price_cents) : null,
      negotiatedPriceCents: license?.negotiated_price_cents != null ? Number(license.negotiated_price_cents) : null,
      pricingVersion: license?.pricing_version != null ? Number(license.pricing_version) : null,
    },
  })
}
