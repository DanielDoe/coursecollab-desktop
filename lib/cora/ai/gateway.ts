import type { OpenAIClient } from "@/lib/openai-with-fallback"
import { createWithFallback } from "@/lib/openai-with-fallback"
import { resolveModelForFeature, type AiFeature } from "@/lib/resolve-feature-ai-model"
import {
  calculateProviderCostUsd,
  providerCostToCoraCredits,
} from "@/lib/cora/ai/pricing"
import { extractRawModelUsage, emptyUsage } from "@/lib/cora/ai/usage-extract"
import { recordUsageEvent, startAgentRun } from "@/lib/cora/ai/ledger"
import {
  ensureCreditAccount,
  finalizeCreditCharge,
  migrateOpeningBalanceFromLegacy,
  reserveCredits,
  releaseReservation,
} from "@/lib/cora/ai/credit-accounts"
import { assertAgentRunBudget, isExpensiveModel } from "@/lib/cora/ai/budget"
import type {
  CoraAiFeature,
  CoraAiProvider,
  CoraUsageContext,
  GatewayChatResult,
  RawModelUsage,
} from "@/lib/cora/ai/types"
import { buildModelOpts, isResponsesModel } from "@/lib/openai-model-params"
import { estimateCoraCreditsForMessage } from "@/lib/cora/credits/economy"
import {
  logCoraExternalAiCall,
  sanitizeMessagesForExternalAi,
} from "@/lib/cora/privacy/ai-data-minimization"

const FEATURE_MAP: Partial<Record<AiFeature, CoraAiFeature>> = {
  tutor: "CHAT",
  summary: "STUDY_PLAN",
  generation: "QUESTION_GENERATION",
  question_generation: "QUESTION_GENERATION",
  codebench: "CODE_HELP",
  insights: "ANALYTICS",
  content_tools: "OTHER",
  verify_answers: "GRADING",
  announcement_summary: "OTHER",
  notification_summary: "OTHER",
  circuit_vision: "DOCUMENT_ANALYSIS",
  document_vision: "DOCUMENT_ANALYSIS",
  code: "CODE_HELP",
  progress_review: "ANALYTICS",
}

export function mapAiFeature(feature: AiFeature | string): CoraAiFeature {
  return FEATURE_MAP[feature as AiFeature] ?? "OTHER"
}

async function maybeMigrate(ctx: CoraUsageContext) {
  if (ctx.actor.userRole === "student" || ctx.actor.userRole === "instructor") {
    try {
      await migrateOpeningBalanceFromLegacy({
        userId: ctx.actor.userId,
        userRole: ctx.actor.userRole,
        membershipTier: ctx.actor.membershipTier,
      })
    } catch {
      /* non-fatal */
    }
  }
}

/**
 * Central Cora AI gateway for chat-style completions.
 * All billable model traffic should flow here (or through recordModelCall after a direct SDK call).
 */
export async function coraGatewayChat(args: {
  openai: OpenAIClient
  context: CoraUsageContext
  messages: { role: string; content: string }[]
  model?: string
  featureHint?: AiFeature
  temperature?: number
  maxTokens?: number
  responseFormat?: { type: string }
  /** Estimated credits to reserve (defaults from message heuristic). */
  reserveEstimate?: number
}): Promise<GatewayChatResult> {
  const started = Date.now()
  await maybeMigrate(args.context)

  const model =
    args.model ??
    (args.featureHint ? resolveModelForFeature(args.featureHint) : undefined) ??
    "gpt-4o-mini"

  const lastUser = [...args.messages].reverse().find((m) => m.role === "user")?.content ?? ""
  const estimate =
    args.reserveEstimate ??
    estimateCoraCreditsForMessage(lastUser)

  let reserved = 0
  if (args.context.billable !== false) {
    await ensureCreditAccount({
      userId: args.context.actor.userId,
      userRole: args.context.actor.userRole,
      membershipTier: args.context.actor.membershipTier,
    })
    const res = await reserveCredits({
      userId: args.context.actor.userId,
      userRole: args.context.actor.userRole,
      amount: estimate,
      membershipTier: args.context.actor.membershipTier,
    })
    if (!res.ok) {
      // Soft-fail: still allow Lite/non-billable callers to proceed with 0 charge path
      if (args.context.billable !== false) {
        throw Object.assign(new Error("INSUFFICIENT_CORA_CREDITS"), {
          code: "INSUFFICIENT_CORA_CREDITS",
          available: res.available,
          needed: estimate,
        })
      }
    } else {
      reserved = estimate
    }
  }

  if (!args.context.agentRunId) {
    args.context.agentRunId = await startAgentRun({ context: args.context })
  }

  let content = ""
  let modelUsed = model
  let usedFallback = false
  let usage: RawModelUsage = emptyUsage()
  let provider: CoraAiProvider = "OPENAI"

  const outboundMessages = sanitizeMessagesForExternalAi(args.messages)
  logCoraExternalAiCall({
    feature: args.context.feature,
    model,
    messageCount: outboundMessages.length,
    promptChars: outboundMessages.reduce((n, m) => n + (m.content?.length ?? 0), 0),
  })

  try {
    const result = await createWithFallback(args.openai, {
      model,
      messages: outboundMessages,
      temperature: args.temperature,
      max_tokens: args.maxTokens,
      response_format: args.responseFormat,
    })
    content = result.content
    modelUsed = result.modelUsed
    usedFallback = result.usedFallback
    usage = (result as { usage?: RawModelUsage }).usage ?? emptyUsage()
    if (modelUsed.toLowerCase().includes("claude")) provider = "ANTHROPIC"
  } catch (err) {
    if (reserved > 0) {
      await releaseReservation({
        userId: args.context.actor.userId,
        userRole: args.context.actor.userRole,
        amount: reserved,
      })
    }
    const latencyMs = Date.now() - started
    await recordUsageEvent({
      context: args.context,
      provider,
      model: modelUsed,
      usage: emptyUsage(),
      providerCostUsd: 0,
      creditsCharged: 0,
      status: "error",
      errorCode: err instanceof Error ? err.message.slice(0, 200) : "error",
      latencyMs,
    })
    throw err
  }

  const providerCostUsd = calculateProviderCostUsd({ provider, model: modelUsed, usage })
  const creditsCharged =
    args.context.billable === false
      ? 0
      : providerCostToCoraCredits(providerCostUsd, {
          billable: true,
          // Missing provider usage still meters a premium turn — otherwise
          // institution-covered students were charged 0 and the UI never moved.
          applyMinimum: true,
        })

  const latencyMs = Date.now() - started
  const usageEventId = await recordUsageEvent({
    context: args.context,
    provider,
    model: modelUsed,
    usage,
    providerCostUsd,
    creditsCharged,
    status: "success",
    latencyMs,
  })

  if (args.context.billable !== false) {
    await finalizeCreditCharge({
      userId: args.context.actor.userId,
      userRole: args.context.actor.userRole,
      reservedAmount: reserved,
      actualCharge: creditsCharged,
      usageEventId,
      agentRunId: args.context.agentRunId,
      membershipTier: args.context.actor.membershipTier,
      description: `${args.context.feature} · ${modelUsed}`,
    })
  } else if (reserved > 0) {
    await releaseReservation({
      userId: args.context.actor.userId,
      userRole: args.context.actor.userRole,
      amount: reserved,
    })
  }

  return {
    content,
    modelUsed,
    provider,
    usage,
    providerCostUsd,
    creditsCharged,
    usageEventId,
    latencyMs,
    usedFallback,
  }
}

/**
 * Record a model call that already happened (e.g. agent loop completion).
 * Use when the call cannot be routed through coraGatewayChat.
 */
export async function recordModelCall(args: {
  context: CoraUsageContext
  provider?: CoraAiProvider
  model: string
  rawResponse?: unknown
  usage?: RawModelUsage
  status?: "success" | "error" | "partial"
  errorCode?: string | null
  latencyMs?: number
  /** When set, skip auto-charge (caller manages reservation). */
  skipCharge?: boolean
  reservedAmount?: number
}): Promise<{
  usage: RawModelUsage
  providerCostUsd: number
  creditsCharged: number
  usageEventId: number | null
}> {
  await maybeMigrate(args.context)
  if (!args.context.agentRunId) {
    args.context.agentRunId = await startAgentRun({ context: args.context })
  }

  const usage = args.usage ?? extractRawModelUsage(args.rawResponse)
  const provider = args.provider ?? "OPENAI"
  const providerCostUsd = calculateProviderCostUsd({
    provider,
    model: args.model,
    usage,
  })
  const creditsCharged =
    args.context.billable === false || args.status === "error"
      ? 0
      : providerCostToCoraCredits(providerCostUsd, {
          billable: true,
          applyMinimum: args.status !== "error",
        })

  const usageEventId = await recordUsageEvent({
    context: args.context,
    provider,
    model: args.model,
    usage,
    providerCostUsd,
    creditsCharged,
    status: args.status ?? "success",
    errorCode: args.errorCode,
    latencyMs: args.latencyMs,
  })

  if (!args.skipCharge && args.context.billable !== false && creditsCharged > 0) {
    const { creditDescriptionForUsage } = await import("@/lib/cora/ai/classify-usage")
    await finalizeCreditCharge({
      userId: args.context.actor.userId,
      userRole: args.context.actor.userRole,
      reservedAmount: args.reservedAmount ?? 0,
      actualCharge: creditsCharged,
      usageEventId,
      agentRunId: args.context.agentRunId,
      membershipTier: args.context.actor.membershipTier,
      description: creditDescriptionForUsage({
        feature: args.context.feature,
        module: args.context.module,
        operation: args.context.operation,
        toolName: args.context.toolName,
        model: args.model,
      }),
    })
  }

  if (args.context.actor.institutionId && providerCostUsd > 0) {
    try {
      const { recordInstitutionSpend } = await import("@/lib/cora/ai/institution-pool")
      await recordInstitutionSpend({
        institutionId: args.context.actor.institutionId,
        providerCostUsd,
      })
    } catch {
      /* soft pool only */
    }
  }

  return { usage, providerCostUsd, creditsCharged, usageEventId }
}

/** Direct Chat Completions via gateway with usage capture (agent loops). */
export async function coraGatewayChatCompletions(args: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  openai: any
  context: CoraUsageContext
  model: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  messages: any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tools?: any[]
  toolChoice?: "auto" | "none"
  temperature?: number
  maxTokens?: number
  modelCallsSoFar?: number
  expensiveModelCallsSoFar?: number
  creditsChargedSoFar?: number
}): Promise<{
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  completion: any
  usage: RawModelUsage
  providerCostUsd: number
  creditsCharged: number
  usageEventId: number | null
  latencyMs: number
}> {
  const budget = assertAgentRunBudget({
    modelCallsSoFar: args.modelCallsSoFar ?? 0,
    expensiveModelCallsSoFar: args.expensiveModelCallsSoFar ?? 0,
    creditsChargedSoFar: args.creditsChargedSoFar ?? 0,
    nextModel: args.model,
    nextEstimatedCredits: 5,
  })
  if (!budget.ok) {
    throw Object.assign(new Error(budget.reason), { code: "CORA_BUDGET_EXCEEDED" })
  }

  await maybeMigrate(args.context)
  if (!args.context.agentRunId) {
    args.context.agentRunId = await startAgentRun({ context: args.context })
  }

  const started = Date.now()
  // Preserve tool_calls / tool_call_id — sanitizer only redacts PII in content.
  const outboundMessages = sanitizeMessagesForExternalAi(
    args.messages.map((m) => ({
      role: String(m.role ?? "user"),
      content: typeof m.content === "string" ? m.content : JSON.stringify(m.content ?? ""),
      ...(m.tool_calls != null ? { tool_calls: m.tool_calls } : {}),
      ...(typeof m.tool_call_id === "string" && m.tool_call_id
        ? { tool_call_id: m.tool_call_id }
        : {}),
      ...(typeof m.name === "string" && m.name ? { name: m.name } : {}),
    })),
  )
  logCoraExternalAiCall({
    feature: args.context.feature,
    model: args.model,
    messageCount: outboundMessages.length,
    promptChars: outboundMessages.reduce((n, m) => n + (m.content?.length ?? 0), 0),
  })
  const completion = await args.openai.chat.completions.create({
    model: args.model,
    messages: outboundMessages,
    tools: args.tools?.length ? args.tools : undefined,
    tool_choice: args.tools?.length ? args.toolChoice ?? "auto" : undefined,
    ...buildModelOpts(args.model, {
      temperature: args.temperature ?? 0.5,
      max_tokens: args.maxTokens ?? 1600,
    }),
  })
  const latencyMs = Date.now() - started
  const recorded = await recordModelCall({
    context: args.context,
    model: args.model,
    rawResponse: completion,
    latencyMs,
    skipCharge: false,
  })

  return {
    completion,
    usage: recorded.usage,
    providerCostUsd: recorded.providerCostUsd,
    creditsCharged: recorded.creditsCharged,
    usageEventId: recorded.usageEventId,
    latencyMs,
  }
}

export { isExpensiveModel, isResponsesModel }
