import { sql } from "@/lib/db"
import { ensureCoraAiAccountingSchema } from "@/lib/cora/ai/schema"
import type {
  AgentRunTotals,
  CoraAiFeature,
  CoraAiProvider,
  CoraRoutingClass,
  CoraUsageContext,
  CoraUserRole,
  RawModelUsage,
} from "@/lib/cora/ai/types"
import { emptyUsage } from "@/lib/cora/ai/usage-extract"
import { randomUUID } from "crypto"

export async function startAgentRun(args: {
  context: CoraUsageContext
}): Promise<string> {
  await ensureCoraAiAccountingSchema()
  const id = args.context.agentRunId || randomUUID()
  const a = args.context.actor
  await sql`
    INSERT INTO cora_agent_runs (
      id, user_id, user_role, membership_tier, institution_id, course_id, section_id,
      conversation_id, request_id, parent_run_id, feature, module, status
    ) VALUES (
      ${id},
      ${a.userId},
      ${a.userRole},
      ${a.membershipTier ?? null},
      ${a.institutionId ?? null},
      ${a.courseId ?? null},
      ${a.sectionId ?? null},
      ${args.context.conversationId ?? null},
      ${args.context.requestId ?? null},
      ${args.context.parentRunId ?? null},
      ${args.context.feature},
      ${args.context.module ?? null},
      'running'
    )
    ON CONFLICT (id) DO NOTHING
  `
  return id
}

export async function completeAgentRun(args: {
  agentRunId: string
  status?: "success" | "error" | "cancelled"
  totals: AgentRunTotals
  latencyMs?: number
  errorCode?: string | null
}): Promise<void> {
  await ensureCoraAiAccountingSchema()
  await sql`
    UPDATE cora_agent_runs SET
      status = ${args.status ?? "success"},
      model_calls = ${args.totals.modelCalls},
      tool_calls = ${args.totals.toolCalls},
      input_tokens = ${args.totals.inputTokens},
      cached_input_tokens = ${args.totals.cachedInputTokens},
      output_tokens = ${args.totals.outputTokens},
      reasoning_tokens = ${args.totals.reasoningTokens},
      total_tokens = ${args.totals.totalTokens},
      provider_cost_usd = ${args.totals.providerCostUsd},
      credits_charged = ${args.totals.creditsCharged},
      latency_ms = ${args.latencyMs ?? null},
      error_code = ${args.errorCode ?? null},
      completed_at = CURRENT_TIMESTAMP
    WHERE id = ${args.agentRunId}
  `
}

export async function recordUsageEvent(args: {
  context: CoraUsageContext
  provider: CoraAiProvider
  model: string
  usage: RawModelUsage
  providerCostUsd: number
  creditsCharged: number
  status?: "success" | "error" | "partial"
  errorCode?: string | null
  latencyMs?: number
}): Promise<number | null> {
  await ensureCoraAiAccountingSchema()
  const a = args.context.actor
  const u = args.usage
  const rows = (await sql`
    INSERT INTO cora_usage_events (
      user_id, user_role, membership_tier, institution_id, course_id, section_id,
      conversation_id, request_id, agent_run_id, parent_run_id,
      feature, module, operation, provider, model, routing_class,
      input_tokens, cached_input_tokens, output_tokens, reasoning_tokens, total_tokens,
      provider_cost_usd, internal_cost_usd, credits_charged, billable,
      tool_name, tool_calls_count, status, error_code, latency_ms
    ) VALUES (
      ${a.userId},
      ${a.userRole},
      ${a.membershipTier ?? null},
      ${a.institutionId ?? null},
      ${a.courseId ?? null},
      ${a.sectionId ?? null},
      ${args.context.conversationId ?? null},
      ${args.context.requestId ?? null},
      ${args.context.agentRunId ?? null},
      ${args.context.parentRunId ?? null},
      ${args.context.feature},
      ${args.context.module ?? null},
      ${args.context.operation ?? null},
      ${args.provider},
      ${args.model},
      ${args.context.routingClass ?? null},
      ${u.inputTokens},
      ${u.cachedInputTokens},
      ${u.outputTokens},
      ${u.reasoningTokens},
      ${u.totalTokens},
      ${args.providerCostUsd},
      ${args.providerCostUsd},
      ${args.creditsCharged},
      ${args.context.billable !== false},
      ${args.context.toolName ?? null},
      ${args.context.toolCallsCount ?? 0},
      ${args.status ?? "success"},
      ${args.errorCode ?? null},
      ${args.latencyMs ?? null}
    )
    RETURNING id
  `) as Array<{ id: number }>

  const eventId = rows[0]?.id ?? null
  if (eventId != null && a.userRole === "student") {
    const { recordCoraInteractionEvent } = await import("@/lib/cora/insights/record")
    await recordCoraInteractionEvent({
      userId: a.userId,
      courseId: a.courseId ?? null,
      sectionId: a.sectionId ?? null,
      conversationId: args.context.conversationId ?? null,
      feature: args.context.feature,
      module: args.context.module,
      latencyMs: args.latencyMs ?? null,
      tokensIn: u.inputTokens,
      tokensOut: u.outputTokens,
      creditsUsed: args.creditsCharged,
      source: "usage",
      sourceRef: `usage:${eventId}`,
    }).catch(() => undefined)
  }

  if (args.context.agentRunId && eventId != null) {
    await sql`
      UPDATE cora_agent_runs SET
        model_calls = model_calls + 1,
        tool_calls = tool_calls + ${args.context.toolCallsCount ?? 0},
        input_tokens = input_tokens + ${u.inputTokens},
        cached_input_tokens = cached_input_tokens + ${u.cachedInputTokens},
        output_tokens = output_tokens + ${u.outputTokens},
        reasoning_tokens = reasoning_tokens + ${u.reasoningTokens},
        total_tokens = total_tokens + ${u.totalTokens},
        provider_cost_usd = provider_cost_usd + ${args.providerCostUsd},
        credits_charged = credits_charged + ${args.creditsCharged}
      WHERE id = ${args.context.agentRunId}
    `
  }

  // Token charge line
  if (eventId != null && args.providerCostUsd > 0) {
    await sql`
      INSERT INTO cora_provider_charges (usage_event_id, charge_type, quantity, unit, cost_usd, provider)
      VALUES (
        ${eventId},
        'TOKENS',
        ${u.totalTokens},
        'tokens',
        ${args.providerCostUsd},
        ${args.provider}
      )
    `
  }

  return eventId
}

export async function sumUsageForUser(args: {
  userRole: CoraUserRole
  userId: number
  since?: Date
}): Promise<{
  creditsCharged: number
  providerCostUsd: number
  inputTokens: number
  cachedInputTokens: number
  outputTokens: number
  reasoningTokens: number
  totalTokens: number
  interactions: number
  agentRuns: number
}> {
  await ensureCoraAiAccountingSchema()
  const since = args.since ?? new Date(0)
  const rows = (await sql`
    SELECT
      COALESCE(SUM(credits_charged), 0)::int AS credits_charged,
      COALESCE(SUM(provider_cost_usd), 0)::float AS provider_cost_usd,
      COALESCE(SUM(input_tokens), 0)::bigint AS input_tokens,
      COALESCE(SUM(cached_input_tokens), 0)::bigint AS cached_input_tokens,
      COALESCE(SUM(output_tokens), 0)::bigint AS output_tokens,
      COALESCE(SUM(reasoning_tokens), 0)::bigint AS reasoning_tokens,
      COALESCE(SUM(total_tokens), 0)::bigint AS total_tokens,
      COUNT(*)::int AS interactions
    FROM cora_usage_events
    WHERE user_role = ${args.userRole}
      AND user_id = ${args.userId}
      AND created_at >= ${since.toISOString()}
  `) as Array<Record<string, number>>

  const agentRows = (await sql`
    SELECT COUNT(*)::int AS agent_runs
    FROM cora_agent_runs
    WHERE user_role = ${args.userRole}
      AND user_id = ${args.userId}
      AND started_at >= ${since.toISOString()}
  `) as Array<{ agent_runs: number }>

  const r = rows[0] || {}
  return {
    creditsCharged: Number(r.credits_charged ?? 0),
    providerCostUsd: Number(r.provider_cost_usd ?? 0),
    inputTokens: Number(r.input_tokens ?? 0),
    cachedInputTokens: Number(r.cached_input_tokens ?? 0),
    outputTokens: Number(r.output_tokens ?? 0),
    reasoningTokens: Number(r.reasoning_tokens ?? 0),
    totalTokens: Number(r.total_tokens ?? 0),
    interactions: Number(r.interactions ?? 0),
    agentRuns: Number(agentRows[0]?.agent_runs ?? 0),
  }
}

export async function listUsageActivity(args: {
  userRole: CoraUserRole
  userId: number
  limit?: number
  offset?: number
  /** Case-insensitive search across feature/module/operation/tool/model. */
  query?: string | null
}): Promise<{
  activity: Array<{
    id: number
    feature: CoraAiFeature
    module: string | null
    operation: string | null
    toolName: string | null
    model: string | null
    provider: string | null
    creditsCharged: number
    totalTokens: number
    inputTokens: number
    cachedInputTokens: number
    outputTokens: number
    reasoningTokens: number
    agentRunId: string | null
    createdAt: string
    latencyMs: number | null
    status: string | null
  }>
  hasMore: boolean
  nextOffset: number
  total: number
  limit: number
  offset: number
}> {
  await ensureCoraAiAccountingSchema()
  const limit = Math.min(50, Math.max(1, args.limit ?? 5))
  const offset = Math.max(0, Math.floor(args.offset ?? 0))
  const q = String(args.query ?? "").trim()
  const like = q ? `%${q}%` : null

  const countRows = (await sql`
    SELECT COUNT(*)::int AS total
    FROM cora_usage_events
    WHERE user_role = ${args.userRole}
      AND user_id = ${args.userId}
      AND (
        ${like}::text IS NULL
        OR feature ILIKE ${like}
        OR COALESCE(module, '') ILIKE ${like}
        OR COALESCE(operation, '') ILIKE ${like}
        OR COALESCE(tool_name, '') ILIKE ${like}
        OR COALESCE(model, '') ILIKE ${like}
      )
  `) as Array<{ total: number }>
  const total = Number(countRows[0]?.total ?? 0)

  const rows = (await sql`
    SELECT id, feature, module, operation, tool_name, model, provider, credits_charged, total_tokens,
           input_tokens, cached_input_tokens, output_tokens, reasoning_tokens,
           agent_run_id, created_at, latency_ms, status
    FROM cora_usage_events
    WHERE user_role = ${args.userRole}
      AND user_id = ${args.userId}
      AND (
        ${like}::text IS NULL
        OR feature ILIKE ${like}
        OR COALESCE(module, '') ILIKE ${like}
        OR COALESCE(operation, '') ILIKE ${like}
        OR COALESCE(tool_name, '') ILIKE ${like}
        OR COALESCE(model, '') ILIKE ${like}
      )
    ORDER BY created_at DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `) as Array<Record<string, unknown>>

  const nextOffset = offset + rows.length
  return {
    activity: rows.map((row) => ({
      id: Number(row.id),
      feature: String(row.feature) as CoraAiFeature,
      module: row.module != null ? String(row.module) : null,
      operation: row.operation != null ? String(row.operation) : null,
      toolName: row.tool_name != null ? String(row.tool_name) : null,
      model: (row.model as string) ?? null,
      provider: row.provider != null ? String(row.provider) : null,
      creditsCharged: Number(row.credits_charged ?? 0),
      totalTokens: Number(row.total_tokens ?? 0),
      inputTokens: Number(row.input_tokens ?? 0),
      cachedInputTokens: Number(row.cached_input_tokens ?? 0),
      outputTokens: Number(row.output_tokens ?? 0),
      reasoningTokens: Number(row.reasoning_tokens ?? 0),
      agentRunId: (row.agent_run_id as string) ?? null,
      createdAt: String(row.created_at),
      latencyMs: row.latency_ms != null ? Number(row.latency_ms) : null,
      status: row.status != null ? String(row.status) : null,
    })),
    hasMore: nextOffset < total,
    nextOffset,
    total,
    limit,
    offset,
  }
}

export function zeroTotals(): AgentRunTotals {
  const u = emptyUsage()
  return {
    modelCalls: 0,
    toolCalls: 0,
    ...u,
    providerCostUsd: 0,
    creditsCharged: 0,
  }
}
