/**
 * Model-specific parameters for OpenAI Chat Completions API
 * (POST /v1/chat/completions)
 *
 * IMPORTANT: Two different OpenAI APIs exist:
 *
 * 1. Chat Completions API (what we use): messages, max_tokens / max_completion_tokens
 * 2. Responses API (client.responses.create): input, max_output_tokens
 *
 * For gpt-5-mini on Chat Completions:
 *   - Use max_completion_tokens (NOT max_tokens) — max_tokens causes API errors
 *   - Omit temperature — only default (1) is supported; other values fail
 *   Ref: https://github.com/BerriAI/litellm/pull/13390
 *
 * For gpt-4o-mini: standard params (max_tokens, temperature)
 */

const GPT5_MODELS = [
  "gpt-5-mini",
  "gpt-5-mini-2025-08-07",
  "gpt-5-nano",
  "gpt-5.1-mini",
  "gpt-5.4",
  "gpt-5.4-mini",
  "gpt-5.4-nano",
  "gpt-5.5",
]

export function isGpt5Mini(model: string | null | undefined): boolean {
  if (!model) return false
  const m = model.toLowerCase()
  return GPT5_MODELS.some((g) => m === g || m.startsWith(g + "-"))
}

/** GPT-5 models use Responses API (client.responses.create), not Chat Completions. */
export function isResponsesModel(model: string): boolean {
  return model.includes("gpt-5")
}

export interface ChatOpts {
  temperature?: number
  max_tokens?: number
  max_completion_tokens?: number
  max_output_tokens?: number
  top_p?: number
  frequency_penalty?: number
  presence_penalty?: number
  response_format?: { type: string }
  [key: string]: unknown
}

/** Token limit - accept any of the common param names */
function getTokenLimit(opts: ChatOpts): number | undefined {
  return opts.max_tokens ?? opts.max_completion_tokens ?? opts.max_output_tokens
}

/**
 * Build request options for Chat Completions API.
 * Used only for gpt-4o-mini and other chat models.
 * GPT-5 models use Responses API (client.responses.create) and must NOT use this.
 */
export function buildModelOpts(model: string, opts: ChatOpts): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  const tokens = getTokenLimit(opts)
  const gpt5 = isGpt5Mini(model)

  // GPT-5 Chat Completions: max_completion_tokens only; temperature must be omitted (default 1).
  if (!gpt5 && opts.temperature != null) out.temperature = opts.temperature
  if (tokens != null) {
    if (gpt5) out.max_completion_tokens = tokens
    else out.max_tokens = tokens
  }
  if (opts.top_p != null) out.top_p = opts.top_p
  if (opts.frequency_penalty != null) out.frequency_penalty = opts.frequency_penalty
  if (opts.presence_penalty != null) out.presence_penalty = opts.presence_penalty
  if (opts.response_format) out.response_format = opts.response_format

  return out
}
