import type { CoraAiProvider, ModelPriceRow, RawModelUsage } from "@/lib/cora/ai/types"
import { CORA_CREDITS_PER_USD, CORA_MIN_PREMIUM_CREDITS } from "@/lib/cora/credits/economy"

/**
 * Versioned provider pricing. Historical events keep cost calculated at request time.
 * Do not reprice past usage with current rows.
 */
export const MODEL_PRICE_TABLE: ModelPriceRow[] = [
  // GPT-5.4 family (2026)
  {
    provider: "OPENAI",
    model: "gpt-5.4-nano",
    inputCostPerMillion: 0.2,
    cachedInputCostPerMillion: 0.02,
    outputCostPerMillion: 1.25,
    effectiveFrom: "2026-01-01",
    effectiveUntil: null,
  },
  {
    provider: "OPENAI",
    model: "gpt-5.4-mini",
    inputCostPerMillion: 0.75,
    cachedInputCostPerMillion: 0.075,
    outputCostPerMillion: 4.5,
    effectiveFrom: "2026-01-01",
    effectiveUntil: null,
  },
  {
    provider: "OPENAI",
    model: "gpt-5.4",
    inputCostPerMillion: 2.5,
    cachedInputCostPerMillion: 0.25,
    outputCostPerMillion: 15,
    effectiveFrom: "2026-01-01",
    effectiveUntil: null,
  },
  {
    provider: "OPENAI",
    model: "gpt-5-mini",
    inputCostPerMillion: 0.75,
    cachedInputCostPerMillion: 0.075,
    outputCostPerMillion: 4.5,
    effectiveFrom: "2025-08-01",
    effectiveUntil: null,
  },
  {
    provider: "OPENAI",
    model: "gpt-5-nano",
    inputCostPerMillion: 0.2,
    cachedInputCostPerMillion: 0.02,
    outputCostPerMillion: 1.25,
    effectiveFrom: "2025-08-01",
    effectiveUntil: null,
  },
  {
    provider: "OPENAI",
    model: "gpt-5",
    inputCostPerMillion: 2.5,
    cachedInputCostPerMillion: 0.25,
    outputCostPerMillion: 15,
    effectiveFrom: "2025-08-01",
    effectiveUntil: null,
  },
  {
    provider: "OPENAI",
    model: "gpt-4o-mini",
    inputCostPerMillion: 0.15,
    cachedInputCostPerMillion: 0.075,
    outputCostPerMillion: 0.6,
    effectiveFrom: "2024-07-01",
    effectiveUntil: null,
  },
  {
    provider: "OPENAI",
    model: "gpt-4o",
    inputCostPerMillion: 2.5,
    cachedInputCostPerMillion: 1.25,
    outputCostPerMillion: 10,
    effectiveFrom: "2024-05-01",
    effectiveUntil: null,
  },
  {
    provider: "OPENAI",
    model: "gpt-4.1-mini",
    inputCostPerMillion: 0.4,
    cachedInputCostPerMillion: 0.1,
    outputCostPerMillion: 1.6,
    effectiveFrom: "2025-04-01",
    effectiveUntil: null,
  },
  {
    provider: "OPENAI",
    model: "gpt-4.1",
    inputCostPerMillion: 2.0,
    cachedInputCostPerMillion: 0.5,
    outputCostPerMillion: 8.0,
    effectiveFrom: "2025-04-01",
    effectiveUntil: null,
  },
  // Anthropic Sonnet 5 intro then standard
  {
    provider: "ANTHROPIC",
    model: "claude-sonnet-5",
    inputCostPerMillion: 2.0,
    cachedInputCostPerMillion: 0.2,
    outputCostPerMillion: 10,
    effectiveFrom: "2026-01-01",
    effectiveUntil: "2026-08-31",
  },
  {
    provider: "ANTHROPIC",
    model: "claude-sonnet-5",
    inputCostPerMillion: 3.0,
    cachedInputCostPerMillion: 0.3,
    outputCostPerMillion: 15,
    effectiveFrom: "2026-09-01",
    effectiveUntil: null,
  },
  {
    provider: "ANTHROPIC",
    model: "claude-haiku-4.5",
    inputCostPerMillion: 1.0,
    cachedInputCostPerMillion: 0.1,
    outputCostPerMillion: 5.0,
    effectiveFrom: "2026-01-01",
    effectiveUntil: null,
  },
  {
    provider: "ANTHROPIC",
    model: "claude-haiku-4",
    inputCostPerMillion: 0.8,
    cachedInputCostPerMillion: 0.08,
    outputCostPerMillion: 4.0,
    effectiveFrom: "2025-10-01",
    effectiveUntil: null,
  },
  {
    provider: "ANTHROPIC",
    model: "claude-3-5-haiku",
    inputCostPerMillion: 0.8,
    cachedInputCostPerMillion: 0.08,
    outputCostPerMillion: 4.0,
    effectiveFrom: "2024-10-01",
    effectiveUntil: null,
  },
]

const DEFAULT_PRICE: ModelPriceRow = {
  provider: "OPENAI",
  model: "gpt-5.4-mini",
  inputCostPerMillion: 0.75,
  cachedInputCostPerMillion: 0.075,
  outputCostPerMillion: 4.5,
  effectiveFrom: "2026-01-01",
  effectiveUntil: null,
}

/** Configurable: 1000 Cora Credits ≈ $1 target AI cost. */
export function getCoraCreditsPerUsd(): number {
  const env = Number(process.env.CORA_CREDITS_PER_USD)
  if (Number.isFinite(env) && env > 0) return env
  return CORA_CREDITS_PER_USD
}

export function getMinPremiumCredits(): number {
  const env = Number(process.env.CORA_MIN_PREMIUM_CREDITS)
  if (Number.isFinite(env) && env >= 0) return env
  return CORA_MIN_PREMIUM_CREDITS
}

export function resolveModelPrice(
  model: string | null | undefined,
  provider: CoraAiProvider = "OPENAI",
  at: Date = new Date(),
): ModelPriceRow {
  const key = (model || "").trim().toLowerCase()
  const day = at.toISOString().slice(0, 10)
  const candidates = MODEL_PRICE_TABLE.filter((row) => {
    if (row.provider !== provider) return false
    if (day < row.effectiveFrom) return false
    if (row.effectiveUntil && day > row.effectiveUntil) return false
    return key === row.model || key.startsWith(row.model)
  })
  if (candidates.length === 0) return { ...DEFAULT_PRICE, provider }
  // Prefer longest model name match
  candidates.sort((a, b) => b.model.length - a.model.length)
  return candidates[0]!
}

export function calculateProviderCostUsd(args: {
  provider?: CoraAiProvider
  model?: string | null
  usage: RawModelUsage
  timestamp?: Date
}): number {
  const price = resolveModelPrice(args.model, args.provider ?? "OPENAI", args.timestamp ?? new Date())
  const cached = Math.max(0, args.usage.cachedInputTokens || 0)
  const uncachedInput = Math.max(0, (args.usage.inputTokens || 0) - cached)
  const reasoning = Math.max(0, args.usage.reasoningTokens || 0)
  const inputCost =
    (uncachedInput / 1_000_000) * price.inputCostPerMillion +
    (cached / 1_000_000) * price.cachedInputCostPerMillion
  const outputCost = (Math.max(0, args.usage.outputTokens || 0) / 1_000_000) * price.outputCostPerMillion
  const reasoningRate = price.reasoningCostPerMillion ?? price.outputCostPerMillion
  const reasoningCost = (reasoning / 1_000_000) * reasoningRate
  return inputCost + outputCost + reasoningCost
}

export function estimateCacheSavingsUsd(args: {
  provider?: CoraAiProvider
  model?: string | null
  cachedInputTokens: number
  timestamp?: Date
}): number {
  const price = resolveModelPrice(args.model, args.provider ?? "OPENAI", args.timestamp ?? new Date())
  const cached = Math.max(0, args.cachedInputTokens)
  const full = (cached / 1_000_000) * price.inputCostPerMillion
  const discounted = (cached / 1_000_000) * price.cachedInputCostPerMillion
  return Math.max(0, full - discounted)
}

export type CreditConversionContext = {
  featureMultiplier?: number
  membershipMultiplier?: number
  promotionalMultiplier?: number
  billable?: boolean
  applyMinimum?: boolean
}

/** Server-side only. Never trust client cost/credit claims. */
export function providerCostToCoraCredits(
  providerCostUsd: number,
  ctx: CreditConversionContext = {},
): number {
  if (ctx.billable === false) return 0
  if (!Number.isFinite(providerCostUsd) || providerCostUsd <= 0) {
    return ctx.applyMinimum === false ? 0 : getMinPremiumCredits()
  }
  const feature = ctx.featureMultiplier ?? 1
  const membership = ctx.membershipMultiplier ?? 1
  const promo = ctx.promotionalMultiplier ?? 1
  const raw = providerCostUsd * getCoraCreditsPerUsd() * feature * membership * promo
  const rounded = Math.max(0, Math.ceil(raw))
  if (ctx.applyMinimum === false) return rounded
  return Math.max(getMinPremiumCredits(), rounded)
}
