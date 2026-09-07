/**
 * Cora dynamic AI router — picks OpenAI vs Claude and cheap vs expensive models.
 *
 * Policy (product):
 * - Coding / debugging / algorithms → prefer Claude (falls back to OpenAI if no key)
 * - Creative design, brainstorming, writing, open-ended thinking → prefer ChatGPT (OpenAI)
 * - Simple lookups / short Q&A → cheapest tier (nano / Haiku)
 * - Complex multi-step / deep reasoning → expensive tier (GPT-5.4 / Sonnet; Opus only when forced)
 *
 * Server is authoritative. Clients may send hints; never invent billing from the client.
 */

import {
  isAnthropicApiKeyConfigured,
  isOpenAiApiKeyConfigured,
  resolveAnthropicFastModelId,
  resolveAnthropicModelId,
  shouldUseAnthropic,
} from "@/lib/ai-env"
import type { AiFeature } from "@/lib/resolve-feature-ai-model"
import type { AiModelPreset } from "@/lib/ai-model-catalog"
import {
  resolveOpenAiFastModel,
  resolveOpenAiDefaultModel,
  resolveOpenAiGradingModel,
  resolveOpenAiTutorModel,
} from "@/lib/ai-openai-models"
import { isCoraMultiModelRoutingEnabled } from "@/lib/cora/models/flags"
import { complexityToLegacy, routeCoraModel } from "@/lib/cora/models/router"
import type {
  CoraModelProfile,
  CoraModelRequestContext,
  CoraPortal,
  CoraTaskCategory,
  CoraUserRole,
} from "@/lib/cora/models/types"

export type CoraTaskDomain =
  | "code"
  | "creative"
  | "reasoning"
  | "teaching"
  | "general"
  | "lightweight"

export type CoraTaskComplexity = "simple" | "medium" | "complex"

export type CoraDynamicRoute = {
  domain: CoraTaskDomain
  complexity: CoraTaskComplexity
  /** Preferred provider after key availability. */
  provider: "openai" | "anthropic"
  /** Feature hint for accounting / createForFeature. */
  feature: AiFeature
  /** Preset for resolveAiModel / createForFeature. */
  aiModelPreset: AiModelPreset
  /** Concrete model id to call. */
  modelId: string
  /** Safe OpenAI model when tool-calling agent cannot use Anthropic. */
  agentModelId: string
  temperature: number
  maxTokens: number
  /** Human-readable reason (logs / optional client meta — never show raw system prompts). */
  reason: string
  /** True when Claude was preferred but agent tools force OpenAI. */
  agentForcesOpenAi: boolean
  /** Capability profile when multi-model routing is enabled. */
  profile?: CoraModelProfile
}

const CODE_RE =
  /\b(code|coding|debug|compile|runtime|segfault|pointer|algorithm|leetcode|refactor|typescript|javascript|python|java\b|c\+\+|cpp|matlab|sql|regex|api\s*route|stack\s*trace|function\s*\(|```|npm |git |dockerfile|kubernetes)\b/i

const CREATIVE_RE =
  /\b(design|creative|brainstorm|ideate|story|narrative|metaphor|analogy|poster|slide\s*deck|pitch|branding|visual|ux|ui\s*copy|tagline|poem|essay|rewrite\s*creatively|imagine|what\s*if)\b/i

const REASONING_RE =
  /\b(prove|proof|derive|why\s+does|trade-?off|compare|contrast|critique|analyze|architecture|system\s*design|optimiz|complexity|big-?o|edge\s*cases)\b/i

const TEACHING_RE =
  /\b(explain|teach|tutor|lesson|concept|understand|eli5|walk\s*me\s*through|help\s*me\s*learn|flashcard|study\s*plan|quiz\s*me)\b/i

const LIGHTWEIGHT_RE =
  /\b(what\s+is|define|when\s+is|due\s+date|deadline|grade|schedule|syllabus|office\s*hours|how\s+do\s+i\s+open|navigate|go\s+to)\b/i

const COMPLEX_RE =
  /\b(comprehensive|entire|full\s+exam|multi-?step|architecture|from\s+scratch|end-?to-?end|production|optimize|performance|memory\s+leak|race\s+condition|distributed|concurrent|prove\s+that|formal)\b/i

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

export function classifyCoraTaskDomain(
  message: string,
  history?: { content?: string }[],
): CoraTaskDomain {
  const blob = [message, ...(history ?? []).slice(-4).map((h) => String(h.content ?? ""))]
    .join("\n")
    .slice(0, 8000)

  if (CODE_RE.test(blob) || /```[\s\S]{20,}/.test(blob)) return "code"
  if (LIGHTWEIGHT_RE.test(message) && wordCount(message) < 25 && !CODE_RE.test(message)) {
    return "lightweight"
  }
  if (CREATIVE_RE.test(blob)) return "creative"
  if (REASONING_RE.test(blob)) return "reasoning"
  if (TEACHING_RE.test(blob)) return "teaching"
  return "general"
}

export function classifyCoraTaskComplexity(
  message: string,
  history?: { content?: string }[],
): CoraTaskComplexity {
  const words = wordCount(message)
  const histLen = (history ?? []).length
  const hasCodeFence = /```/.test(message)
  const complexHits = COMPLEX_RE.test(message) ? 1 : 0

  let score = 0
  if (words < 18 && !hasCodeFence) score -= 2
  if (words > 80 || hasCodeFence) score += 2
  if (words > 160) score += 2
  if (histLen >= 6) score += 1
  if (complexHits) score += 2
  if (/\b(debug|optimize|refactor|architect)\b/i.test(message)) score += 2
  if (/^[?\s]*$/.test(message) || /^(hi|hello|hey|thanks)\b/i.test(message.trim())) score -= 3

  if (score >= 3) return "complex"
  if (score <= -1) return "simple"
  return "medium"
}

function domainToFeature(domain: CoraTaskDomain): AiFeature {
  switch (domain) {
    case "code":
      return "code"
    case "creative":
      return "generation"
    case "lightweight":
      return "summary"
    case "reasoning":
    case "teaching":
    case "general":
    default:
      return "tutor"
  }
}

function pickOpenAiModel(domain: CoraTaskDomain, complexity: CoraTaskComplexity): {
  preset: AiModelPreset
  modelId: string
} {
  if (domain === "lightweight" || complexity === "simple") {
    return { preset: "gpt-5.4-nano", modelId: resolveOpenAiFastModel() }
  }
  if (domain === "code") {
    if (complexity === "complex") {
      return { preset: "gpt-5.4", modelId: resolveOpenAiGradingModel() }
    }
    return { preset: "gpt-5.4-mini", modelId: resolveOpenAiTutorModel() }
  }
  if (domain === "creative" || domain === "reasoning") {
    if (complexity === "complex") {
      return { preset: "gpt-5.4", modelId: resolveOpenAiGradingModel() }
    }
    return { preset: "gpt-5.4-mini", modelId: resolveOpenAiDefaultModel() }
  }
  if (complexity === "complex") {
    return { preset: "gpt-5.4", modelId: resolveOpenAiGradingModel() }
  }
  return { preset: "gpt-5.4-mini", modelId: resolveOpenAiDefaultModel() }
}

function pickClaudeModel(domain: CoraTaskDomain, complexity: CoraTaskComplexity): {
  preset: AiModelPreset
  modelId: string
} {
  if (domain === "lightweight" || complexity === "simple") {
    return { preset: "claude-haiku-4-5", modelId: resolveAnthropicFastModelId() }
  }
  // Coding + complex → Sonnet (Opus reserved for grading disputes, not chat spend)
  return {
    preset: "claude-sonnet-5",
    modelId: resolveAnthropicModelId("claude-sonnet-5"),
  }
}

function preferProvider(domain: CoraTaskDomain): "openai" | "anthropic" {
  const hasClaude = isAnthropicApiKeyConfigured()
  const hasOpenAi = isOpenAiApiKeyConfigured()

  // Coding → Claude when available
  if (domain === "code" && hasClaude) return "anthropic"
  // Creative / teaching / general thinking → ChatGPT when available
  if ((domain === "creative" || domain === "teaching" || domain === "general" || domain === "reasoning") && hasOpenAi) {
    return "openai"
  }
  if (domain === "lightweight") {
    // Prefer cheapest available
    if (hasOpenAi) return "openai"
    if (hasClaude) return "anthropic"
  }
  if (hasOpenAi) return "openai"
  if (hasClaude) return "anthropic"
  return "openai"
}

function tokensFor(complexity: CoraTaskComplexity, domain: CoraTaskDomain): number {
  if (complexity === "simple" || domain === "lightweight") return 500
  if (complexity === "complex") return domain === "code" ? 2800 : 2400
  return 1400
}

function temperatureFor(domain: CoraTaskDomain, complexity: CoraTaskComplexity): number {
  if (domain === "creative") return 0.85
  if (domain === "code") return complexity === "complex" ? 0.35 : 0.45
  if (domain === "lightweight") return 0.3
  return 0.65
}

/**
 * Resolve provider + model for a Cora turn.
 * Agent tool loops support both OpenAI and Anthropic (Claude tool_use).
 */
function profileToDomain(profile: CoraModelProfile): CoraTaskDomain {
  switch (profile) {
    case "coding":
      return "code"
    case "tutor":
      return "teaching"
    case "lite":
    case "fast":
      return "lightweight"
    case "reasoning":
    case "advanced_reasoning":
    case "verifier":
      return "reasoning"
    default:
      return "general"
  }
}

function profileToPreset(profile: CoraModelProfile, provider: "openai" | "anthropic"): AiModelPreset {
  if (provider === "anthropic") {
    return profile === "lite" || profile === "fast" ? "claude-haiku-4-5" : "claude-sonnet-5"
  }
  if (profile === "lite" || profile === "fast") return "gpt-5.4-nano"
  if (profile === "advanced_reasoning") return "gpt-5.5"
  if (profile === "reasoning" || profile === "long_context" || profile === "verifier") return "gpt-5.4"
  return "gpt-5.4-mini"
}

function toLegacyDynamicRoute(
  opts: Parameters<typeof resolveCoraDynamicRoute>[0],
): CoraDynamicRoute {
  const ctx: CoraModelRequestContext = {
    userRole: (opts.userRole ?? "student") as CoraUserRole,
    portal: (opts.portal ?? "student") as CoraPortal,
    membershipTier: opts.membershipTier,
    courseId: opts.courseId,
    message: opts.message,
    conversationHistory: opts.conversationHistory,
    coraLiteMode: opts.coraLiteMode,
    hasImages: opts.hasImages,
    hasFiles: opts.hasFiles,
    estimatedContextTokens: opts.estimatedContextTokens,
    requiresTools: opts.forAgentTools,
    agenticAction: opts.forAgentTools,
    requiresVision: opts.hasImages,
    requiresLongContext: opts.requiresLongContext,
    taskCategory: opts.taskCategory,
    riskLevel: opts.riskLevel,
    assessmentContext: opts.assessmentContext,
    highImpact: opts.highImpact,
    requestedOperation: opts.requestedOperation,
    clientProfileHint: opts.domainHint,
    courseRoutingPolicy: opts.courseRoutingPolicy,
  }
  const routed = routeCoraModel(ctx)
  const domain = profileToDomain(routed.profile)
  return {
    domain,
    complexity: complexityToLegacy(routed.estimatedComplexity),
    provider: routed.provider,
    feature: domainToFeature(domain),
    aiModelPreset: profileToPreset(routed.profile, routed.provider),
    modelId: routed.model,
    agentModelId: routed.model,
    temperature: routed.temperature,
    maxTokens: routed.maxOutputTokens,
    reason: routed.reason,
    agentForcesOpenAi: false,
    profile: routed.profile,
  }
}

/**
 * Resolve provider + model for a Cora turn.
 * Agent tool loops support both OpenAI and Anthropic (Claude tool_use).
 */
export function resolveCoraDynamicRoute(opts: {
  message: string
  conversationHistory?: { content?: string }[]
  /** Optional client hint — never trusted for auth, only soft bias. */
  domainHint?: CoraTaskDomain | null
  learningGoal?: string | null
  forAgentTools?: boolean
  userRole?: CoraUserRole
  portal?: CoraPortal
  membershipTier?: string | null
  courseId?: number | null
  coraLiteMode?: boolean
  hasImages?: boolean
  hasFiles?: boolean
  estimatedContextTokens?: number
  requiresLongContext?: boolean
  taskCategory?: CoraTaskCategory
  riskLevel?: CoraModelRequestContext["riskLevel"]
  assessmentContext?: CoraModelRequestContext["assessmentContext"]
  highImpact?: boolean
  requestedOperation?: string | null
  courseRoutingPolicy?: CoraModelRequestContext["courseRoutingPolicy"]
}): CoraDynamicRoute {
  if (isCoraMultiModelRoutingEnabled()) {
    return toLegacyDynamicRoute(opts)
  }
  let domain = classifyCoraTaskDomain(opts.message, opts.conversationHistory)
  if (opts.domainHint && opts.domainHint !== "general") {
    domain = opts.domainHint
  }
  // Learning goals soft-bias
  const goal = String(opts.learningGoal ?? "").toLowerCase()
  if (goal === "create" && domain === "general") domain = "creative"
  if ((goal === "solve_together" || goal === "review") && CODE_RE.test(opts.message)) {
    domain = "code"
  }

  const complexity = classifyCoraTaskComplexity(opts.message, opts.conversationHistory)
  const preferred = preferProvider(domain)
  const feature = domainToFeature(domain)

  let provider = preferred
  let agentForcesOpenAi = false

  // Agent tools: keep preferred provider when keys exist (OpenAI + Claude tool loops).
  // Only force OpenAI if Anthropic was preferred but no Anthropic key.
  if (opts.forAgentTools && provider === "anthropic" && !isAnthropicApiKeyConfigured()) {
    provider = isOpenAiApiKeyConfigured() ? "openai" : "anthropic"
    agentForcesOpenAi = provider === "openai"
  }

  const picked =
    provider === "anthropic"
      ? pickClaudeModel(domain, complexity)
      : pickOpenAiModel(domain, complexity)

  // Fallback OpenAI model when Anthropic tool loop fails mid-turn
  const agentPick = pickOpenAiModel(domain === "code" ? "code" : domain, complexity)

  const reasonParts = [
    `domain=${domain}`,
    `complexity=${complexity}`,
    `prefer=${preferred}`,
    `use=${provider}:${picked.modelId}`,
  ]
  if (agentForcesOpenAi) {
    reasonParts.push(`agentOpenAiFallback=${agentPick.modelId}`)
  }
  if (opts.forAgentTools && provider === "anthropic") {
    reasonParts.push("agentTools=anthropic")
  } else if (opts.forAgentTools) {
    reasonParts.push("agentTools=openai")
  }

  return {
    domain,
    complexity,
    provider,
    feature,
    aiModelPreset: picked.preset,
    modelId: picked.modelId,
    agentModelId: agentPick.modelId,
    temperature: temperatureFor(domain, complexity),
    maxTokens: tokensFor(complexity, domain),
    reason: reasonParts.join(" · "),
    agentForcesOpenAi,
  }
}

/** Whether the concrete model should go through Anthropic Messages API. */
export function routeUsesAnthropic(route: CoraDynamicRoute): boolean {
  return shouldUseAnthropic(route.modelId) && route.provider === "anthropic"
}
