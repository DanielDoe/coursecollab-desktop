import { sql } from "@/lib/db"
import type {
  CoraPurposeClassification,
  CoraScopeDecision,
  CoraScopeMode,
} from "@/lib/cora/scope/types"
import type { CoraPrincipalRole } from "@/lib/cora/security/types"

let schemaReady: Promise<void> | null = null

export async function ensureCoraScopeEventsSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS cora_scope_events (
          id BIGSERIAL PRIMARY KEY,
          user_id INTEGER,
          user_role TEXT NOT NULL,
          institution_id INTEGER,
          classification TEXT NOT NULL,
          decision TEXT NOT NULL,
          confidence DOUBLE PRECISION,
          reason_code TEXT,
          mode TEXT NOT NULL,
          enforced BOOLEAN NOT NULL DEFAULT FALSE,
          credits_charged INTEGER NOT NULL DEFAULT 0,
          false_positive BOOLEAN,
          feedback_note TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `
      await sql`
        CREATE INDEX IF NOT EXISTS idx_cora_scope_events_created
        ON cora_scope_events (created_at DESC)
      `
      await sql`
        CREATE INDEX IF NOT EXISTS idx_cora_scope_events_class
        ON cora_scope_events (classification, created_at DESC)
      `
    })()
  }
  await schemaReady
}

export async function recordCoraScopeEvent(args: {
  userId?: number | null
  userRole: CoraPrincipalRole
  institutionId?: number | null
  classification: CoraPurposeClassification
  decision: CoraScopeDecision
  confidence: number
  reasonCode: string
  mode: CoraScopeMode
  enforced: boolean
  creditsCharged?: number
}): Promise<number | null> {
  try {
    await ensureCoraScopeEventsSchema()
    const rows = (await sql`
      INSERT INTO cora_scope_events (
        user_id, user_role, institution_id, classification, decision,
        confidence, reason_code, mode, enforced, credits_charged
      ) VALUES (
        ${args.userId ?? null},
        ${args.userRole},
        ${args.institutionId ?? null},
        ${args.classification},
        ${args.decision},
        ${args.confidence},
        ${args.reasonCode},
        ${args.mode},
        ${args.enforced},
        ${args.creditsCharged ?? 0}
      )
      RETURNING id
    `) as Array<{ id: number }>
    return rows[0]?.id ?? null
  } catch (err) {
    console.warn("[cora.scope] record event failed", err)
    return null
  }
}

export async function recordCoraScopeFeedback(args: {
  eventId?: number | null
  userId: number
  userRole: CoraPrincipalRole
  related: boolean
  note?: string | null
}): Promise<void> {
  await ensureCoraScopeEventsSchema()
  if (args.eventId) {
    await sql`
      UPDATE cora_scope_events
      SET false_positive = ${args.related},
          feedback_note = ${args.note?.slice(0, 500) ?? null}
      WHERE id = ${args.eventId}
        AND user_id = ${args.userId}
        AND user_role = ${args.userRole}
    `
    return
  }
  await sql`
    INSERT INTO cora_scope_events (
      user_id, user_role, classification, decision, confidence,
      reason_code, mode, enforced, credits_charged, false_positive, feedback_note
    ) VALUES (
      ${args.userId},
      ${args.userRole},
      'CLEARLY_UNRELATED',
      'REDIRECT',
      1,
      'USER_FEEDBACK',
      'enforce',
      true,
      0,
      ${args.related},
      ${args.note?.slice(0, 500) ?? null}
    )
  `
}

export type CoraScopeAggregateStats = {
  total: number
  byClassification: Record<string, number>
  byDecision: Record<string, number>
  enforcedRedirects: number
  falsePositiveReports: number
  creditsProtected: number
}

export async function aggregateCoraScopeStats(since: Date): Promise<CoraScopeAggregateStats> {
  await ensureCoraScopeEventsSchema()
  const totals = (await sql`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE enforced AND decision = 'REDIRECT')::int AS enforced_redirects,
      COUNT(*) FILTER (WHERE false_positive IS TRUE)::int AS false_positives,
      COALESCE(SUM(CASE WHEN enforced AND decision = 'REDIRECT' THEN 1 ELSE 0 END), 0)::int AS redirect_count
    FROM cora_scope_events
    WHERE created_at >= ${since.toISOString()}
  `) as Array<Record<string, number>>

  const byClass = (await sql`
    SELECT classification, COUNT(*)::int AS n
    FROM cora_scope_events
    WHERE created_at >= ${since.toISOString()}
    GROUP BY classification
  `) as Array<{ classification: string; n: number }>

  const byDecision = (await sql`
    SELECT decision, COUNT(*)::int AS n
    FROM cora_scope_events
    WHERE created_at >= ${since.toISOString()}
    GROUP BY decision
  `) as Array<{ decision: string; n: number }>

  const t = totals[0] || {}
  return {
    total: Number(t.total ?? 0),
    byClassification: Object.fromEntries(byClass.map((r) => [r.classification, Number(r.n)])),
    byDecision: Object.fromEntries(byDecision.map((r) => [r.decision, Number(r.n)])),
    enforcedRedirects: Number(t.enforced_redirects ?? 0),
    falsePositiveReports: Number(t.false_positives ?? 0),
    // Each enforced redirect avoided a premium completion — approximate as 1 protected interaction
    creditsProtected: Number(t.enforced_redirects ?? 0),
  }
}
