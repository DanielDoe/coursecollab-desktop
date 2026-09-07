/**
 * OpenAI Chat Completions with automatic fallback to gpt-4o-mini
 *
 * GPT-5 mini: Uses Responses API (client.responses.create) - output_text, max_output_tokens
 * gpt-4o-mini: Uses Chat Completions API - max_tokens, temperature
 * Try primary model first; fall back to gpt-4o-mini if unavailable or empty.
 */

import { buildModelOpts, isResponsesModel, type ChatOpts } from "./openai-model-params"
import { shouldUseAnthropic, isOpenAiApiKeyConfigured } from "./ai-env"
import { createWithAnthropic } from "./anthropic-chat"
import { resolveOpenAiApiFallbackModel, resolveOpenAiDefaultModel } from "@/lib/ai-openai-models"
import { extractRawModelUsage, emptyUsage } from "@/lib/cora/ai/usage-extract"
import type { RawModelUsage } from "@/lib/cora/ai/types"

function chatFallbackOpts(opts: {
  temperature?: number
  max_tokens?: number
  response_format?: { type: string }
}): ChatOpts {
  return {
    temperature: opts.temperature ?? 0.7,
    max_tokens: opts.max_tokens,
    response_format: opts.response_format,
  }
}

const PRIMARY_MODEL = resolveOpenAiDefaultModel()
export const FALLBACK_MODEL = resolveOpenAiApiFallbackModel()

export interface ChatCompletionOptions {
  model?: string
  messages: { role: string; content: string }[]
  temperature?: number
  max_tokens?: number
  top_p?: number
  frequency_penalty?: number
  presence_penalty?: number
  response_format?: { type: string }
  [key: string]: unknown
}

export interface ChatCompletionResult {
  content: string
  modelUsed: string
  usedFallback: boolean
  usage: RawModelUsage
}

/** Accepts OpenAI SDK client (openai package). Compatible with `new OpenAI()`. */
export type OpenAIClient = {
  chat: {
    completions: {
      create: (opts: unknown) => Promise<{
        choices?: Array<{ message?: { content?: string } }>
        usage?: unknown
      }>
    }
  }
  responses?: {
    create: (opts: unknown) => Promise<{
      output_text?: string
      status?: string
      incomplete_details?: { reason?: string }
      usage?: unknown
    }>
  }
}

const callGpt5ResponsesAPI = async (
  openai: OpenAIClient,
  model: string,
  messages: { role: string; content: string }[],
  opts: { max_tokens?: number; response_format?: { type: string } },
): Promise<{ content: string; usage: RawModelUsage }> => {
  if (!openai.responses) {
    throw new Error("OpenAI client does not support Responses API - ensure SDK supports openai.responses.create")
  }

  const body: Record<string, unknown> = {
    model,
    input: messages.map((m) => ({
      role: m.role as "user" | "assistant" | "system" | "developer",
      content: m.content,
    })),
    reasoning: { effort: "low" },
    max_output_tokens: opts.max_tokens ?? 1500,
  }
  if (opts.response_format) {
    body.text = { format: opts.response_format }
  }

  const response = await openai.responses.create(body)

  const text = (response.output_text ?? "").trim()

  if (!text || response.status === "incomplete") {
    const reason = (response as { incomplete_details?: { reason?: string } }).incomplete_details?.reason || "unknown"
    throw new Error(`GPT-5 incomplete or empty response: ${reason}`)
  }

  return { content: text, usage: extractRawModelUsage(response) }
}

/**
 * Call OpenAI with automatic fallback.
 * GPT-5: Responses API (output_text). gpt-4o-mini: Chat Completions API.
 */
export async function chatCompletionWithFallback(
  apiKey: string,
  options: ChatCompletionOptions
): Promise<ChatCompletionResult> {
  if (shouldUseAnthropic(options.model)) {
    const result = await createWithAnthropic({
      model: options.model,
      messages: options.messages as { role: string; content: string }[],
      temperature: options.temperature,
      max_tokens: options.max_tokens,
      response_format: options.response_format,
    })
    return {
      content: result.content,
      modelUsed: result.modelUsed,
      usedFallback: result.usedFallback,
      usage: emptyUsage(),
    }
  }

  const primaryModel = options.model || PRIMARY_MODEL
  const baseOpts = {
    max_tokens: options.max_tokens ?? 1000,
    temperature: options.temperature ?? 0.7,
    top_p: options.top_p,
    frequency_penalty: options.frequency_penalty,
    presence_penalty: options.presence_penalty,
    response_format: options.response_format,
  }

  async function callChatCompletions(
    model: string,
  ): Promise<{ content: string | null; error?: string; usage: RawModelUsage }> {
    const modelOpts = buildModelOpts(model, baseOpts)
    const reqBody = { model, messages: options.messages, ...modelOpts }
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(reqBody),
    })
    const data = await res.json()

    if (!res.ok) {
      const errMsg = data?.error?.message || res.statusText
      return { content: null, error: errMsg, usage: emptyUsage() }
    }

    const content = data?.choices?.[0]?.message?.content ?? null
    return { content, usage: extractRawModelUsage(data) }
  }

  if (isResponsesModel(primaryModel)) {
    try {
      const { OpenAI } = await import("openai")
      const openai = new OpenAI({ apiKey }) as OpenAIClient
      const { content, usage } = await callGpt5ResponsesAPI(openai, primaryModel, options.messages, baseOpts)
      return { content, modelUsed: primaryModel, usedFallback: false, usage }
    } catch (err) {
      const msg = (err as Error)?.message ?? "unknown"
      console.warn("[Fallback Triggered]", msg)
      const fallback = await callChatCompletions(FALLBACK_MODEL)
      if (fallback.content?.trim()) {
        return {
          content: fallback.content,
          modelUsed: FALLBACK_MODEL,
          usedFallback: true,
          usage: fallback.usage,
        }
      }
      throw new Error(`Model failed: ${msg}`)
    }
  }

  const primary = await callChatCompletions(primaryModel)
  if (primary.content?.trim()) {
    return {
      content: primary.content,
      modelUsed: primaryModel,
      usedFallback: false,
      usage: primary.usage,
    }
  }

  if (primaryModel !== FALLBACK_MODEL) {
    console.warn(`[OpenAI] ${primaryModel} failed (${primary.error || "empty response"}), retrying with ${FALLBACK_MODEL}`)
    const fallback = await callChatCompletions(FALLBACK_MODEL)
    if (fallback.content?.trim()) {
      return {
        content: fallback.content,
        modelUsed: FALLBACK_MODEL,
        usedFallback: true,
        usage: fallback.usage,
      }
    }
    throw new Error(`Model failed: ${fallback.error || primary.error || "OpenAI returned empty response"}`)
  }

  throw new Error(`Model failed: ${primary.error || "OpenAI returned empty response"}`)
}

/**
 * Wrapper for OpenAI SDK - tries primary model first, falls back to gpt-4o-mini.
 * GPT-5: Responses API. gpt-4o-mini: Chat Completions API.
 */
export async function createWithFallback(
  openai: OpenAIClient | { chat: unknown; responses?: unknown },
  opts: {
    model?: string
    messages: { role: string; content: string }[]
    temperature?: number
    max_tokens?: number
    max_completion_tokens?: number
    max_output_tokens?: number
    top_p?: number
    frequency_penalty?: number
    presence_penalty?: number
    response_format?: { type: string }
  }
): Promise<{ content: string; modelUsed: string; usedFallback: boolean; usage: RawModelUsage }> {
  if (shouldUseAnthropic(opts.model)) {
    try {
      const result = await createWithAnthropic({
        model: opts.model,
        messages: opts.messages,
        temperature: opts.temperature,
        max_tokens: opts.max_tokens ?? opts.max_completion_tokens ?? opts.max_output_tokens,
        response_format: opts.response_format,
      })
      return { ...result, usage: emptyUsage() }
    } catch (err) {
      const msg = (err as Error)?.message ?? "unknown"
      if (!isOpenAiApiKeyConfigured()) {
        throw err
      }
      console.warn(`[Anthropic] All Claude models failed (${msg}); falling back to OpenAI`)
    }
  }

  const primaryModel = opts.model || PRIMARY_MODEL
  const tokenLimit = opts.max_tokens ?? opts.max_completion_tokens ?? opts.max_output_tokens ?? 1500

  const client = openai as OpenAIClient
  try {
    if (isResponsesModel(primaryModel)) {
      const { content, usage } = await callGpt5ResponsesAPI(client, primaryModel, opts.messages, {
        max_tokens: tokenLimit,
        response_format: opts.response_format as { type: string } | undefined,
      })
      return { content, modelUsed: primaryModel, usedFallback: false, usage }
    }

    const chatOpts: ChatOpts = {
      temperature: opts.temperature ?? 0.7,
      max_tokens: tokenLimit,
      top_p: opts.top_p,
      frequency_penalty: opts.frequency_penalty,
      presence_penalty: opts.presence_penalty,
      response_format: opts.response_format,
    }
    const modelOpts = buildModelOpts(primaryModel, chatOpts) as Record<string, number | string | object | undefined>
    const completion = await client.chat.completions.create({
      model: primaryModel,
      messages: opts.messages,
      ...modelOpts,
    })

    const content = completion.choices?.[0]?.message?.content?.trim()
    if (!content) {
      throw new Error("Empty response from chat model")
    }
    return {
      content,
      modelUsed: primaryModel,
      usedFallback: false,
      usage: extractRawModelUsage(completion),
    }
  } catch (err) {
    const msg = (err as Error)?.message ?? "unknown"
    console.warn("[Fallback Triggered]", msg)

    const fallback = await client.chat.completions.create({
      model: FALLBACK_MODEL,
      messages: opts.messages,
      ...buildModelOpts(FALLBACK_MODEL, chatFallbackOpts({
        temperature: opts.temperature,
        max_tokens: tokenLimit,
        response_format: opts.response_format as { type: string } | undefined,
      })),
    })

    const content = fallback.choices?.[0]?.message?.content?.trim()
    return {
      content: content || `Model failed: ${msg}`,
      modelUsed: FALLBACK_MODEL,
      usedFallback: true,
      usage: extractRawModelUsage(fallback),
    }
  }
}
