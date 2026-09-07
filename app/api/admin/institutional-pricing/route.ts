import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireAdminId } from "@/lib/admin-api-auth"
import { ensureInstitutionSchema } from "@/lib/ensure-institution-schema"
import { catalogPricingAnalysis, PRICING_ANALYSIS_DISCLAIMER } from "@/lib/institutional-pricing"
import { INSTITUTION_PRICING_VERSION } from "@/lib/institution-plans"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const auth = await requireAdminId(request)
  if (!auth.ok) return auth.response
  await ensureInstitutionSchema()

  const quotes = await sql`
    SELECT
      COUNT(*)::int AS quotes_created,
      COALESCE(SUM(COALESCE(negotiated_price_cents, annual_price_cents, 0)), 0)::bigint AS quote_value_cents,
      COUNT(*) FILTER (WHERE status = 'accepted')::int AS quotes_accepted,
      COALESCE(AVG(discount_cents) FILTER (WHERE discount_cents > 0), 0)::int AS avg_discount_cents
    FROM institution_quotes
  `
  const licenses = await sql`
    SELECT
      COUNT(*) FILTER (WHERE status = 'active')::int AS active_customers,
      COALESCE(SUM(negotiated_price_cents) FILTER (WHERE status = 'active'), 0)::bigint AS active_arr_cents,
      COALESCE(SUM(seat_limit_students) FILTER (WHERE status = 'active'), 0)::int AS licensed_capacity,
      COALESCE(AVG(negotiated_price_cents) FILTER (WHERE status = 'active'), 0)::int AS avg_contract_cents
    FROM institution_licenses
  `
  const created = Number(quotes[0]?.quotes_created ?? 0)
  const accepted = Number(quotes[0]?.quotes_accepted ?? 0)
  const arr = Number(licenses[0]?.active_arr_cents ?? 0)

  return NextResponse.json({
    pricingVersion: INSTITUTION_PRICING_VERSION,
    disclaimer: PRICING_ANALYSIS_DISCLAIMER,
    catalog: catalogPricingAnalysis(),
    sales: {
      quotesCreated: created,
      quoteValueCents: Number(quotes[0]?.quote_value_cents ?? 0),
      quoteAcceptanceBps: created > 0 ? Math.trunc((accepted * 10_000) / created) : null,
      averageDiscountCents: Number(quotes[0]?.avg_discount_cents ?? 0),
      averageContractValueCents: Number(licenses[0]?.avg_contract_cents ?? 0),
      annualContractValueCents: arr,
      activeInstitutionalArrCents: arr,
      institutionalMrrEquivalentCents: Math.trunc((arr + 6) / 12),
      activeInstitutionalCustomers: Number(licenses[0]?.active_customers ?? 0),
      licensedActiveLearnerCapacity: Number(licenses[0]?.licensed_capacity ?? 0),
    },
  })
}
