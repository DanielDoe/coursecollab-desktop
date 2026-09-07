/**
 * Central AI provider configuration from environment variables.
 */

export type AiProvider = "openai" | "anthropic" | "auto"

const CLAUDE_PREFIX = /^claude/i

/** UI / legacy aliases → env-backed Anthropic model ids */
const ANTHROPIC_MODEL_ALIASES: Record<string, string> = {
  "claude-3": "ANTHROPIC_DEFAULT_MODEL",
  "claude-3-sonnet": "ANTHROPIC_DEFAULT_MODEL",
  "claude-3-opus": "ANTHROPIC_OPUS_MODEL",
  "claude-3-haiku": "ANTHROPIC_FAST_MODEL",
  "claude-sonnet": "ANTHROPIC_DEFAULT_MODEL",
  "claude-sonnet-5": "ANTHROPIC_DEFAULT_MODEL",
  "claude-haiku": "ANTHROPIC_FAST_MODEL",
  "claude-haiku-4-5": "ANTHROPIC_FAST_MODEL",
  "claude-opus": "ANTHROPIC_OPUS_MODEL",
  "claude-opus-4-8": "ANTHROPIC_OPUS_MODEL",
}

export function getAiProvider(): AiProvider {
  const raw = (process.env.AI_PROVIDER || "auto").trim().toLowerCase()
  if (raw === "openai" || raw === "anthropic" || raw === "auto") return raw
  return "auto"
}

export function isAnthropicApiKeyConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY?.trim()
}

export function isOpenAiApiKeyConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY?.trim()
}

export function isAnthropicModel(model?: string | null): boolean {
  if (!model) return false
  const m = model.trim()
  if (CLAUDE_PREFIX.test(m)) return true
  return m in ANTHROPIC_MODEL_ALIASES
}

/** Retired snapshot ids → current Anthropic replacements (see platform model deprecations). */
const RETIRED_ANTHROPIC_MODEL_IDS: Record<string, string> = {
  "claude-sonnet-4-20250514": "claude-sonnet-4-6",
  "claude-opus-4-20250514": "claude-opus-4-8",
}

function normalizeRetiredAnthropicModelId(modelId: string): string {
  return RETIRED_ANTHROPIC_MODEL_IDS[modelId] ?? modelId
}

/** Public alias — remap retired Anthropic snapshot ids before API calls. */
export function remapRetiredAnthropicModelId(modelId: string): string {
  return normalizeRetiredAnthropicModelId(modelId.trim())
}

export function resolveAnthropicOpusModelId(): string {
  const resolved =
    process.env.ANTHROPIC_OPUS_MODEL?.trim() ||
    resolveAnthropicModelId("claude-opus-4-8")
  return normalizeRetiredAnthropicModelId(resolved)
}

export function resolveAnthropicModelId(model?: string | null): string {
  const fallback =
    process.env.ANTHROPIC_DEFAULT_MODEL?.trim() || "claude-sonnet-4-6"
  if (!model?.trim()) return normalizeRetiredAnthropicModelId(fallback)

  const key = model.trim()
  const aliasEnv = ANTHROPIC_MODEL_ALIASES[key]
  if (aliasEnv) {
    const fromEnv = process.env[aliasEnv]?.trim()
    if (fromEnv) return normalizeRetiredAnthropicModelId(fromEnv)
  }

  if (CLAUDE_PREFIX.test(key)) return normalizeRetiredAnthropicModelId(key)
  return normalizeRetiredAnthropicModelId(fallback)
}

export function resolveAnthropicFastModelId(): string {
  const resolved =
    process.env.ANTHROPIC_FAST_MODEL?.trim() ||
    process.env.ANTHROPIC_DEFAULT_MODEL?.trim() ||
    "claude-haiku-4-5"
  return normalizeRetiredAnthropicModelId(resolved)
}

export function shouldUseAnthropic(model?: string | null): boolean {
  const provider = getAiProvider()
  if (provider === "anthropic") return isAnthropicApiKeyConfigured()
  if (provider === "openai") return false
  return isAnthropicModel(model) && isAnthropicApiKeyConfigured()
}

export function anthropicKeyPreview(): string | null {
  const key = process.env.ANTHROPIC_API_KEY?.trim()
  if (!key) return null
  return `${key.slice(0, 12)}...`
}
