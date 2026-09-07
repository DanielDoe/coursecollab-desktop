import { sql } from "@/lib/db"

export type InstitutionCoraPool = {
  institutionId: number
  periodKey: string
  softBudgetUsd: number
  spentUsd: number
  softLimitHit: boolean
}

let schemaReady: Promise<void> | null = null

export async function ensureInstitutionPoolSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS cora_institution_pools (
          institution_id INTEGER NOT NULL,
          period_key TEXT NOT NULL,
          soft_budget_usd DOUBLE PRECISION NOT NULL DEFAULT 500,
          spent_usd DOUBLE PRECISION NOT NULL DEFAULT 0,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          PRIMARY KEY (institution_id, period_key)
        )
      `
    })()
  }
  await schemaReady
}

function currentPoolPeriodKey(): string {
  const d = new Date()
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`
}

export async function getOrCreateInstitutionPool(args: {
  institutionId: number
  periodKey?: string
  softBudgetUsd?: number
}): Promise<InstitutionCoraPool> {
  await ensureInstitutionPoolSchema()
  const periodKey = args.periodKey ?? currentPoolPeriodKey()
  const soft = args.softBudgetUsd

  if (soft != null && Number.isFinite(soft) && soft >= 0) {
    await sql`
      INSERT INTO cora_institution_pools (institution_id, period_key, soft_budget_usd)
      VALUES (${args.institutionId}, ${periodKey}, ${soft})
      ON CONFLICT (institution_id, period_key) DO UPDATE
      SET soft_budget_usd = ${soft}, updated_at = NOW()
    `
  } else {
    await sql`
      INSERT INTO cora_institution_pools (institution_id, period_key)
      VALUES (${args.institutionId}, ${periodKey})
      ON CONFLICT (institution_id, period_key) DO NOTHING
    `
  }

  const rows = (await sql`
    SELECT institution_id, period_key, soft_budget_usd, spent_usd
    FROM cora_institution_pools
    WHERE institution_id = ${args.institutionId} AND period_key = ${periodKey}
    LIMIT 1
  `) as Array<{
    institution_id: number
    period_key: string
    soft_budget_usd: number
    spent_usd: number
  }>

  const r = rows[0]!
  const softBudgetUsd = Number(r.soft_budget_usd)
  const spentUsd = Number(r.spent_usd)
  return {
    institutionId: Number(r.institution_id),
    periodKey: String(r.period_key),
    softBudgetUsd,
    spentUsd,
    softLimitHit: softBudgetUsd > 0 && spentUsd >= softBudgetUsd,
  }
}

export async function listInstitutionPools(): Promise<InstitutionCoraPool[]> {
  await ensureInstitutionPoolSchema()
  const rows = (await sql`
    SELECT institution_id, period_key, soft_budget_usd, spent_usd
    FROM cora_institution_pools
    ORDER BY updated_at DESC
    LIMIT 50
  `) as Array<{
    institution_id: number
    period_key: string
    soft_budget_usd: number
    spent_usd: number
  }>

  return rows.map((r) => {
    const softBudgetUsd = Number(r.soft_budget_usd)
    const spentUsd = Number(r.spent_usd)
    return {
      institutionId: Number(r.institution_id),
      periodKey: String(r.period_key),
      softBudgetUsd,
      spentUsd,
      softLimitHit: softBudgetUsd > 0 && spentUsd >= softBudgetUsd,
    }
  })
}

/** Soft accounting only — does not hard-block users. */
export async function recordInstitutionSpend(args: {
  institutionId: number
  providerCostUsd: number
  periodKey?: string
}): Promise<void> {
  if (!args.institutionId || !(args.providerCostUsd > 0)) return
  await ensureInstitutionPoolSchema()
  const periodKey = args.periodKey ?? currentPoolPeriodKey()
  await sql`
    INSERT INTO cora_institution_pools (institution_id, period_key, spent_usd)
    VALUES (${args.institutionId}, ${periodKey}, ${args.providerCostUsd})
    ON CONFLICT (institution_id, period_key) DO UPDATE
    SET spent_usd = cora_institution_pools.spent_usd + ${args.providerCostUsd},
        updated_at = NOW()
  `
}
