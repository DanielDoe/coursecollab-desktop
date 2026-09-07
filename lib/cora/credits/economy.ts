/**
 * Cora Credit economy — user-facing units independent of provider token prices.
 *
 * Peg: 100 Cora Credits ≈ $0.10 target AI cost → 1 credit ≈ $0.001
 * (1,000 credits ≈ $1). Router should usually land below that.
 */

import { calculateProviderCostUsd, resolveModelPrice } from "@/lib/cora/ai/pricing"
import type { CoraAiProvider } from "@/lib/cora/ai/types"
import { isCoraLiteEnabled } from "@/lib/cora/models/flags"

export const CORA_CREDITS_PER_USD = 1000
/** Minimum charge for any premium (non-Lite) AI completion. */
export const CORA_MIN_PREMIUM_CREDITS = 5
/** Warn when remaining included credits fall to this fraction of the monthly allocation. */
export const CORA_LOW_BALANCE_FRACTION = 0.25
/** Stronger warning near exhaustion. */
export const CORA_CRITICAL_BALANCE_FRACTION = 0.1
export const CORA_LITE_ENABLED = isCoraLiteEnabled()

function inferProvider(model: string | null | undefined): CoraAiProvider {
  return (model ?? "").toLowerCase().includes("claude") ? "ANTHROPIC" : "OPENAI"
}

export type StudentCoraTier = "Scholar" | "Explorer" | "Trailblazer"

/** Monthly included membership credits (students). Do not roll over. */
export const STUDENT_CORA_MONTHLY: Record<StudentCoraTier, number> = {
  Scholar: 250,
  Explorer: 3000,
  Trailblazer: 7500,
}

export type InstructorCoraTier = "Free" | "Pro" | "Teams"

/** Semester included credits (faculty). Available as a semester pool. */
export const INSTRUCTOR_CORA_SEMESTER: Record<InstructorCoraTier, number> = {
  Free: 500,
  Pro: 15000,
  Teams: 15000,
}

/** Annual included credits when billed annually. */
export const INSTRUCTOR_CORA_ANNUAL: Record<InstructorCoraTier, number> = {
  Free: 500,
  Pro: 45000,
  Teams: 45000,
}

/** Pre-rename Instructor Enterprise included credits — honor existing stored periods. */
export const LEGACY_INSTRUCTOR_ENTERPRISE_CORA_SEMESTER = 35000
export const LEGACY_INSTRUCTOR_ENTERPRISE_CORA_ANNUAL = 105000

export function usdToCoraCredits(usd: number): number {
  if (!Number.isFinite(usd) || usd <= 0) return 0
  return Math.max(0, Math.ceil(usd * CORA_CREDITS_PER_USD))
}

export function resolveModelRates(model: string | null | undefined) {
  const price = resolveModelPrice(model, inferProvider(model), new Date())
  return {
    input: price.inputCostPerMillion,
    output: price.outputCostPerMillion,
    cachedInput: price.cachedInputCostPerMillion,
  }
}

export function tokensToUsdCost(args: {
  model?: string | null
  inputTokens: number
  outputTokens: number
  cachedInputTokens?: number
}): number {
  return calculateProviderCostUsd({
    provider: inferProvider(args.model),
    model: args.model,
    usage: {
      inputTokens: args.inputTokens || 0,
      outputTokens: args.outputTokens || 0,
      cachedInputTokens: args.cachedInputTokens ?? 0,
      reasoningTokens: 0,
      totalTokens: (args.inputTokens || 0) + (args.outputTokens || 0),
    },
  })
}

export function tokensToCoraCredits(args: {
  model?: string | null
  inputTokens: number
  outputTokens: number
  cachedInputTokens?: number
}): number {
  const credits = usdToCoraCredits(tokensToUsdCost(args))
  return Math.max(CORA_MIN_PREMIUM_CREDITS, credits)
}

/** Heuristic pre-estimate before the call (actual charge uses token usage when available). */
export function estimateCoraCreditsForMessage(message: string, opts?: { hasAttachments?: boolean }): number {
  const len = (message || "").trim().length
  const lower = (message || "").toLowerCase()
  const heavy =
    /\b(generate|create|draft|analyze|midterm|final|exam|quiz|homework|rubric|lecture|flashcards?|study plan|comprehensive)\b/i.test(
      lower,
    )
  if (opts?.hasAttachments) return Math.max(40, heavy ? 80 : 40)
  if (heavy && len > 400) return 60
  if (heavy) return 35
  if (len > 400) return 25
  if (len > 120) return 15
  return CORA_MIN_PREMIUM_CREDITS
}

const LITE_BLOCK_RE =
  /\b(generate|create|draft|write|build|compose|make me|design)\b.{0,40}\b(quiz|exam|midterm|final|homework|questions?|flashcards?|study plan|lecture|slides?|rubric|announcement)\b/i

const LITE_ALLOW_RE =
  /\b(what|when|where|which|how many|why|explain|help me understand|show|find|open|go to|navigate|my grade|deadline|due|announcement|schedule|calendar|syllabus|study|review)\b/i

/**
 * Cora Lite: cheap CourseCollab ops when premium balance is 0.
 * Blocks expensive generation; allows navigation / retrieval / simple Q&A.
 */
export function isCoraLiteEligible(message: string): boolean {
  const text = (message || "").trim()
  if (!text) return true
  if (LITE_BLOCK_RE.test(text)) return false
  if (text.length > 500) return false
  return LITE_ALLOW_RE.test(text) || text.length < 160
}

export function studentMonthlyAllocation(tier: StudentCoraTier | string | null | undefined): number {
  if (!tier) return 0
  const key = String(tier) as StudentCoraTier
  return STUDENT_CORA_MONTHLY[key] ?? 0
}

export function instructorPeriodAllocation(
  tier: InstructorCoraTier | string | null | undefined,
  cadence: "semester" | "annual" | null | undefined,
): number {
  const raw = String(tier ?? "Free").trim()
  const key = raw.toLowerCase()
  if (key === "enterprise" || key === "instructor_enterprise") {
    return cadence === "annual"
      ? LEGACY_INSTRUCTOR_ENTERPRISE_CORA_ANNUAL
      : LEGACY_INSTRUCTOR_ENTERPRISE_CORA_SEMESTER
  }
  const canonical = key === "teams" || key === "instructor_teams" ? "Teams" : (raw as InstructorCoraTier)
  const t = (canonical === "Free" || canonical === "Pro" || canonical === "Teams" ? canonical : "Free") as InstructorCoraTier
  if (cadence === "annual") return INSTRUCTOR_CORA_ANNUAL[t] ?? INSTRUCTOR_CORA_ANNUAL.Free
  return INSTRUCTOR_CORA_SEMESTER[t] ?? INSTRUCTOR_CORA_SEMESTER.Free
}
