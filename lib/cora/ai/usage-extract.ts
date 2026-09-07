import type { RawModelUsage } from "@/lib/cora/ai/types"

export function emptyUsage(): RawModelUsage {
  return {
    inputTokens: 0,
    cachedInputTokens: 0,
    outputTokens: 0,
    reasoningTokens: 0,
    totalTokens: 0,
  }
}

export function addUsage(a: RawModelUsage, b: RawModelUsage): RawModelUsage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    cachedInputTokens: a.cachedInputTokens + b.cachedInputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    reasoningTokens: a.reasoningTokens + b.reasoningTokens,
    totalTokens: a.totalTokens + b.totalTokens,
  }
}

/**
 * Extract usage from OpenAI SDK v6 Chat Completions or Responses API payloads.
 * Prefer provider-reported usage; never invent tokens when usage is present.
 */
export function extractRawModelUsage(response: unknown): RawModelUsage {
  if (!response || typeof response !== "object") return emptyUsage()
  const r = response as Record<string, unknown>
  const usage = (r.usage ?? null) as Record<string, unknown> | null
  if (!usage) return emptyUsage()

  // Chat Completions style
  const promptTokens = Number(usage.prompt_tokens ?? 0)
  const completionTokens = Number(usage.completion_tokens ?? 0)
  const totalChat = Number(usage.total_tokens ?? promptTokens + completionTokens)

  // Responses API style
  const inputTokens = Number(usage.input_tokens ?? promptTokens ?? 0)
  const outputTokens = Number(usage.output_tokens ?? completionTokens ?? 0)
  const totalTokens = Number(usage.total_tokens ?? totalChat ?? inputTokens + outputTokens)

  const promptDetails = (usage.prompt_tokens_details ?? usage.input_tokens_details ?? {}) as Record<
    string,
    unknown
  >
  const completionDetails = (usage.completion_tokens_details ??
    usage.output_tokens_details ??
    {}) as Record<string, unknown>

  const cachedInputTokens = Number(
    promptDetails.cached_tokens ?? usage.cached_tokens ?? 0,
  )
  const reasoningTokens = Number(
    completionDetails.reasoning_tokens ?? usage.reasoning_tokens ?? 0,
  )

  return {
    inputTokens: Number.isFinite(inputTokens) ? inputTokens : 0,
    cachedInputTokens: Number.isFinite(cachedInputTokens) ? cachedInputTokens : 0,
    outputTokens: Number.isFinite(outputTokens) ? outputTokens : 0,
    reasoningTokens: Number.isFinite(reasoningTokens) ? reasoningTokens : 0,
    totalTokens: Number.isFinite(totalTokens)
      ? totalTokens
      : (Number.isFinite(inputTokens) ? inputTokens : 0) +
        (Number.isFinite(outputTokens) ? outputTokens : 0),
  }
}
