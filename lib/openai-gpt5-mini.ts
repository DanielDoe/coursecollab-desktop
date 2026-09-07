/**
 * GPT-5 mini API compatibility
 *
 * Per https://github.com/BerriAI/litellm/issues/13381:
 * GPT-5 series: max_completion_tokens (NOT max_tokens), omit temperature
 * gpt-4o-mini: max_tokens, temperature (standard)
 */

import { isGpt5Mini as _isGpt5Mini, buildModelOpts } from "./openai-model-params"

export const isGpt5Mini = _isGpt5Mini

export interface ChatCompletionParams {
  model: string
  messages: unknown[]
  temperature?: number
  max_tokens?: number
  max_completion_tokens?: number
  top_p?: number
  frequency_penalty?: number
  presence_penalty?: number
  response_format?: { type: string }
  [key: string]: unknown
}

/**
 * Build request body for OpenAI Chat Completions API.
 * Model-specific: gpt-5-mini uses max_completion_tokens; gpt-4o-mini uses max_tokens.
 */
export function buildChatCompletionBody(
  params: ChatCompletionParams
): Record<string, unknown> {
  const { model, messages, ...rest } = params
  const opts = buildModelOpts(model, rest as Parameters<typeof buildModelOpts>[1])
  return { model, messages, ...opts }
}

/**
 * Get options for openai.chat.completions.create() - model-specific.
 */
export function getChatCompletionOptions(
  model: string,
  opts: {
    temperature?: number
    max_tokens?: number
    top_p?: number
    frequency_penalty?: number
    presence_penalty?: number
    [key: string]: unknown
  }
): Record<string, unknown> {
  return buildModelOpts(model, opts)
}
