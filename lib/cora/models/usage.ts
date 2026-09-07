import {
  calculateProviderCostUsd,
  providerCostToCoraCredits,
} from "@/lib/cora/ai/pricing"
import type { CoraAiProvider, RawModelUsage } from "@/lib/cora/ai/types"
import type {
  CoraModelProfile,
  CoraModelProvider,
  CoraModelUsage,
  CoraPortal,
  CoraTaskCategory,
  CoraUserRole,
} from "@/lib/cora/models/types"

function toAiProvider(provider: CoraModelProvider): CoraAiProvider {
  return provider === "anthropic" ? "ANTHROPIC" : "OPENAI"
}

export function normalizeCoraModelUsage(input: {
  provider: CoraModelProvider
  model: string
  profile: CoraModelProfile
  usage: RawModelUsage
  userRole: CoraUserRole
  membershipTier?: string | null
  portal?: CoraPortal | null
  sessionId?: string | null
  taskCategory?: CoraTaskCategory | null
  latencyMs: number
  success: boolean
  fallbackUsed?: boolean
  escalationUsed?: boolean
  verificationUsed?: boolean
  toolRounds?: number
  billable?: boolean
  actualProviderCostUsd?: number | null
}): CoraModelUsage {
  const estimatedProviderCostUsd = calculateProviderCostUsd({
    provider: toAiProvider(input.provider),
    model: input.model,
    usage: input.usage,
  })
  const providerCostUsd = input.actualProviderCostUsd ?? estimatedProviderCostUsd
  const creditsCharged =
    input.billable === false
      ? 0
      : providerCostToCoraCredits(providerCostUsd, {
          billable: true,
          applyMinimum: input.success && input.usage.totalTokens > 0,
        })

  return {
    provider: input.provider,
    model: input.model,
    profile: input.profile,
    inputTokens: input.usage.inputTokens,
    cachedInputTokens: input.usage.cachedInputTokens,
    outputTokens: input.usage.outputTokens,
    reasoningTokens: input.usage.reasoningTokens,
    totalTokens: input.usage.totalTokens,
    toolRounds: input.toolRounds,
    estimatedProviderCostUsd,
    actualProviderCostUsd: input.actualProviderCostUsd ?? null,
    creditsCharged,
    userRole: input.userRole,
    membershipTier: input.membershipTier ?? null,
    portal: input.portal ?? null,
    sessionId: input.sessionId ?? null,
    taskCategory: input.taskCategory ?? null,
    latencyMs: input.latencyMs,
    success: input.success,
    fallbackUsed: Boolean(input.fallbackUsed),
    escalationUsed: Boolean(input.escalationUsed),
    verificationUsed: Boolean(input.verificationUsed),
  }
}
