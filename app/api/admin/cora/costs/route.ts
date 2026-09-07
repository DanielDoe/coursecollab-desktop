import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { ensureCoraAiAccountingSchema } from "@/lib/cora/ai"
import { requireAdminId } from "@/lib/admin-api-auth"
import {
  ensureInstitutionPoolSchema,
  getOrCreateInstitutionPool,
  listInstitutionPools,
} from "@/lib/cora/ai/institution-pool"

export const dynamic = "force-dynamic"

/** Admin cost center aggregates. Requires x-admin-id. */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminId(request)
    if (!auth.ok) return auth.response

    await ensureCoraAiAccountingSchema()
    await ensureInstitutionPoolSchema()
    const { ensureCoraPurchaseSchema } = await import("@/lib/cora/credits/fulfill-purchase")
    await ensureCoraPurchaseSchema()

    const { searchParams } = new URL(request.url)
    const since = searchParams.get("since")
      ? new Date(String(searchParams.get("since")))
      : new Date(Date.now() - 30 * 24 * 3600 * 1000)
    const roleFilter = searchParams.get("role")
    const roleOk =
      roleFilter === "student" ||
      roleFilter === "instructor" ||
      roleFilter === "admin" ||
      roleFilter === "guest"
        ? roleFilter
        : null

    const byFeature = (await sql`
      SELECT feature,
             COUNT(*)::int AS requests,
             COALESCE(SUM(total_tokens), 0)::bigint AS total_tokens,
             COALESCE(SUM(provider_cost_usd), 0)::float AS provider_cost_usd,
             COALESCE(SUM(credits_charged), 0)::int AS credits_charged
      FROM cora_usage_events
      WHERE created_at >= ${since.toISOString()}
        AND (${roleOk}::text IS NULL OR user_role = ${roleOk})
      GROUP BY feature
      ORDER BY provider_cost_usd DESC
    `) as Array<Record<string, unknown>>

    const byModel = (await sql`
      SELECT model,
             COUNT(*)::int AS requests,
             COALESCE(SUM(input_tokens), 0)::bigint AS input_tokens,
             COALESCE(SUM(cached_input_tokens), 0)::bigint AS cached_input_tokens,
             COALESCE(SUM(output_tokens), 0)::bigint AS output_tokens,
             COALESCE(SUM(provider_cost_usd), 0)::float AS provider_cost_usd
      FROM cora_usage_events
      WHERE created_at >= ${since.toISOString()}
      GROUP BY model
      ORDER BY provider_cost_usd DESC
      LIMIT 40
    `) as Array<Record<string, unknown>>

    const byRole = (await sql`
      SELECT user_role,
             COUNT(DISTINCT user_id)::int AS active_users,
             COALESCE(SUM(provider_cost_usd), 0)::float AS provider_cost_usd,
             COALESCE(SUM(credits_charged), 0)::int AS credits_charged,
             COALESCE(SUM(total_tokens), 0)::bigint AS total_tokens
      FROM cora_usage_events
      WHERE created_at >= ${since.toISOString()}
      GROUP BY user_role
    `) as Array<Record<string, unknown>>

    const topUsers = (await sql`
      SELECT user_id, user_role,
             COUNT(*)::int AS requests,
             COALESCE(SUM(provider_cost_usd), 0)::float AS provider_cost_usd,
             COALESCE(SUM(credits_charged), 0)::int AS credits_charged
      FROM cora_usage_events
      WHERE created_at >= ${since.toISOString()}
      GROUP BY user_id, user_role
      ORDER BY provider_cost_usd DESC
      LIMIT 25
    `) as Array<Record<string, unknown>>

    const totals = (await sql`
      SELECT
        COALESCE(SUM(provider_cost_usd), 0)::float AS provider_cost_usd,
        COALESCE(SUM(credits_charged), 0)::int AS credits_charged,
        COALESCE(SUM(total_tokens), 0)::bigint AS total_tokens,
        COALESCE(SUM(cached_input_tokens), 0)::bigint AS cached_input_tokens,
        COALESCE(SUM(input_tokens), 0)::bigint AS input_tokens,
        COUNT(*)::int AS requests,
        COUNT(DISTINCT user_id)::int AS active_users
      FROM cora_usage_events
      WHERE created_at >= ${since.toISOString()}
    `) as Array<Record<string, number>>

    const t = totals[0] || {}
    const input = Number(t.input_tokens ?? 0)
    const cached = Number(t.cached_input_tokens ?? 0)
    const cacheRate = input > 0 ? cached / input : 0

    const byOperation = (await sql`
      SELECT COALESCE(NULLIF(operation, ''), 'unknown') AS operation,
             COALESCE(NULLIF(module, ''), 'unknown') AS module,
             COUNT(*)::int AS requests,
             COALESCE(SUM(total_tokens), 0)::bigint AS total_tokens,
             COALESCE(SUM(provider_cost_usd), 0)::float AS provider_cost_usd,
             COALESCE(SUM(credits_charged), 0)::int AS credits_charged
      FROM cora_usage_events
      WHERE created_at >= ${since.toISOString()}
        AND (${roleOk}::text IS NULL OR user_role = ${roleOk})
      GROUP BY 1, 2
      ORDER BY provider_cost_usd DESC
      LIMIT 40
    `) as Array<Record<string, unknown>>

    const byTool = (await sql`
      SELECT COALESCE(NULLIF(tool_name, ''), '(no tool)') AS tool_name,
             COUNT(*)::int AS requests,
             COALESCE(SUM(total_tokens), 0)::bigint AS total_tokens,
             COALESCE(SUM(provider_cost_usd), 0)::float AS provider_cost_usd,
             COALESCE(SUM(credits_charged), 0)::int AS credits_charged
      FROM cora_usage_events
      WHERE created_at >= ${since.toISOString()}
        AND (${roleOk}::text IS NULL OR user_role = ${roleOk})
      GROUP BY 1
      ORDER BY provider_cost_usd DESC
      LIMIT 40
    `) as Array<Record<string, unknown>>

    const byProvider = (await sql`
      SELECT provider,
             COUNT(*)::int AS requests,
             COALESCE(SUM(provider_cost_usd), 0)::float AS provider_cost_usd,
             COALESCE(SUM(credits_charged), 0)::int AS credits_charged
      FROM cora_usage_events
      WHERE created_at >= ${since.toISOString()}
        AND (${roleOk}::text IS NULL OR user_role = ${roleOk})
      GROUP BY provider
      ORDER BY provider_cost_usd DESC
    `) as Array<Record<string, unknown>>

    const institutionPools = await listInstitutionPools()
    const { aggregateCoraScopeStats } = await import("@/lib/cora/scope/events")
    const scopeStats = await aggregateCoraScopeStats(since)

    await sql`
      CREATE TABLE IF NOT EXISTS guest_purchases (
        id SERIAL PRIMARY KEY,
        student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        product_type VARCHAR(32) NOT NULL,
        product_id VARCHAR(64) NOT NULL,
        stripe_session_id TEXT UNIQUE NOT NULL,
        amount_cents INTEGER NOT NULL,
        currency VARCHAR(8) NOT NULL DEFAULT 'usd',
        status VARCHAR(20) NOT NULL DEFAULT 'completed',
        purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `

    const guestEconomyRows = (await sql`
      SELECT
        (SELECT COUNT(*)::int FROM guest_entitlements WHERE plan = 'cora_career' AND status = 'active') AS lifetime_unlocks,
        (SELECT COUNT(*)::int FROM guest_purchases WHERE product_type = 'LIFETIME_ACCESS') AS lifetime_purchases,
        (SELECT COUNT(*)::int FROM guest_purchases WHERE product_type = 'CORA_CREDIT_PACK') AS credit_pack_purchases,
        (SELECT COALESCE(SUM(amount_cents), 0)::int FROM guest_purchases WHERE purchased_at >= ${since.toISOString()}) AS revenue_cents,
        (SELECT COALESCE(SUM(balance), 0)::bigint FROM guest_cora_balances) AS credits_outstanding,
        (SELECT COUNT(*)::int FROM students WHERE COALESCE(is_platform_guest, false) = true) AS platform_guests
    `) as Array<Record<string, number>>
    const ge = guestEconomyRows[0] ?? {}

    const studentByTier = (await sql`
      SELECT COALESCE(cca.membership_tier, 'Scholar') AS tier,
             COUNT(DISTINCT cca.user_id)::int AS active_members,
             COALESCE(AVG(cca.lifetime_credits_used), 0)::float AS avg_lifetime_used,
             COALESCE(SUM(u.credits_charged), 0)::int AS credits_consumed,
             COALESCE(SUM(u.provider_cost_usd), 0)::float AS provider_cost_usd,
             COALESCE(AVG(u.credits_charged), 0)::float AS avg_credits,
             COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY u.credits_charged), 0)::float AS median_credits,
             COALESCE(PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY u.credits_charged), 0)::float AS p90_credits,
             COALESCE(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY u.credits_charged), 0)::float AS p95_credits
      FROM cora_credit_accounts cca
      LEFT JOIN (
        SELECT user_id, SUM(credits_charged) AS credits_charged, SUM(provider_cost_usd) AS provider_cost_usd
        FROM cora_usage_events
        WHERE user_role = 'student' AND created_at >= ${since.toISOString()}
        GROUP BY user_id
      ) u ON u.user_id = cca.user_id
      WHERE cca.user_role = 'student'
      GROUP BY 1
      ORDER BY 1
    `) as Array<Record<string, number | string>>

    const packPurchases = (await sql`
      SELECT COUNT(*)::int AS purchases,
             COALESCE(SUM(amount_cents), 0)::int AS revenue_cents,
             COUNT(DISTINCT buyer_id)::int AS buyers
      FROM cora_credit_purchases
      WHERE audience = 'student' AND created_at >= ${since.toISOString()}
    `) as Array<{ purchases: number; revenue_cents: number; buyers: number }>

    const liteAfterExhaustion = (await sql`
      SELECT COUNT(*)::int AS lite_events
      FROM cora_usage_events
      WHERE user_role = 'student'
        AND created_at >= ${since.toISOString()}
        AND credits_charged = 0
        AND (feature ILIKE '%lite%' OR operation ILIKE '%lite%')
    `) as Array<{ lite_events: number }>

    const guestUsage = (await sql`
      SELECT
        COALESCE(SUM(provider_cost_usd), 0)::float AS provider_cost_usd,
        COALESCE(SUM(credits_charged), 0)::int AS credits_charged,
        COUNT(*)::int AS requests,
        COUNT(DISTINCT user_id)::int AS active_guests
      FROM cora_usage_events
      WHERE created_at >= ${since.toISOString()} AND user_role = 'guest'
    `) as Array<Record<string, number>>
    const gu = guestUsage[0] ?? {}

    return NextResponse.json({
      since: since.toISOString(),
      totals: {
        providerCostUsd: Number(t.provider_cost_usd ?? 0),
        creditsCharged: Number(t.credits_charged ?? 0),
        totalTokens: Number(t.total_tokens ?? 0),
        requests: Number(t.requests ?? 0),
        activeUsers: Number(t.active_users ?? 0),
        cacheRate,
        avgCostPerActiveUser:
          Number(t.active_users ?? 0) > 0
            ? Number(t.provider_cost_usd ?? 0) / Number(t.active_users)
            : 0,
      },
      byFeature,
      byModel,
      byRole,
      byOperation,
      byTool,
      byProvider,
      topUsers,
      institutionPools,
      scopeGuardrail: scopeStats,
      studentEconomy: {
        byTier: studentByTier.map((r) => ({
          tier: String(r.tier),
          activeMembers: Number(r.active_members ?? 0),
          creditsConsumed: Number(r.credits_consumed ?? 0),
          avgCredits: Number(r.avg_credits ?? 0),
          medianCredits: Number(r.median_credits ?? 0),
          p90Credits: Number(r.p90_credits ?? 0),
          p95Credits: Number(r.p95_credits ?? 0),
          providerCostUsd: Number(r.provider_cost_usd ?? 0),
        })),
        creditPacks: {
          purchases: Number(packPurchases[0]?.purchases ?? 0),
          buyers: Number(packPurchases[0]?.buyers ?? 0),
          revenueUsd: Number(packPurchases[0]?.revenue_cents ?? 0) / 100,
        },
        liteEvents: Number(liteAfterExhaustion[0]?.lite_events ?? 0),
      },
      guestEconomy: {
        platformGuests: Number(ge.platform_guests ?? 0),
        lifetimeUnlocks: Number(ge.lifetime_unlocks ?? 0),
        lifetimePurchases: Number(ge.lifetime_purchases ?? 0),
        creditPackPurchases: Number(ge.credit_pack_purchases ?? 0),
        revenueUsd: Number(ge.revenue_cents ?? 0) / 100,
        creditsOutstanding: Number(ge.credits_outstanding ?? 0),
        usageProviderCostUsd: Number(gu.provider_cost_usd ?? 0),
        usageCreditsCharged: Number(gu.credits_charged ?? 0),
        usageRequests: Number(gu.requests ?? 0),
        activeGuestUsers: Number(gu.active_guests ?? 0),
      },
    })
  } catch (error) {
    console.error("[admin/cora/costs]", error)
    return NextResponse.json({ error: "Failed to load admin costs" }, { status: 500 })
  }
}

/** PATCH soft budget for institution pool: { institutionId, softBudgetUsd?, periodKey? } */
export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAdminId(request)
    if (!auth.ok) return auth.response

    const body = (await request.json()) as {
      institutionId?: number
      softBudgetUsd?: number
      periodKey?: string
    }
    const institutionId = Number(body.institutionId)
    if (!Number.isFinite(institutionId) || institutionId <= 0) {
      return NextResponse.json({ error: "institutionId required" }, { status: 400 })
    }

    const pool = await getOrCreateInstitutionPool({
      institutionId,
      periodKey: body.periodKey,
      softBudgetUsd: body.softBudgetUsd,
    })

    return NextResponse.json({ pool })
  } catch (error) {
    console.error("[admin/cora/costs PATCH]", error)
    return NextResponse.json({ error: "Failed to update pool" }, { status: 500 })
  }
}
