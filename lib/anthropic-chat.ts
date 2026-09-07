/**
 * Anthropic Claude Messages API — mirrors createWithFallback result shape.
 */

import Anthropic from "@anthropic-ai/sdk"
import {
  isAnthropicApiKeyConfigured,
  remapRetiredAnthropicModelId,
  resolveAnthropicFastModelId,
  resolveAnthropicModelId,
} from "@/lib/ai-env"

export type AnthropicChatMessage = {
  role: "user" | "assistant" | "system"
  content: string
}

export type AnthropicChatOptions = {
  model?: string
  messages: AnthropicChatMessage[]
  temperature?: number
  max_tokens?: number
  response_format?: { type: string }
}

export type AnthropicChatResult = {
  content: string
  modelUsed: string
  usedFallback: boolean
}

let cachedClient: Anthropic | null = null

export function getAnthropicClient(): Anthropic | null {
  if (!isAnthropicApiKeyConfigured()) return null
  if (!cachedClient) {
    cachedClient = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!.trim(),
    })
  }
  return cachedClient
}

function toAnthropicMessages(messages: AnthropicChatMessage[]): {
  system?: string
  messages: Anthropic.MessageParam[]
} {
  const systemParts = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content.trim())
    .filter(Boolean)

  const chatMessages: Anthropic.MessageParam[] = messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }))

  return {
    system: systemParts.length ? systemParts.join("\n\n") : undefined,
    messages: chatMessages,
  }
}

export async function createWithAnthropic(
  opts: AnthropicChatOptions,
): Promise<AnthropicChatResult> {
  const client = getAnthropicClient()
  if (!client) {
    throw new Error("ANTHROPIC_API_KEY is not configured")
  }

  const primaryModel = remapRetiredAnthropicModelId(resolveAnthropicModelId(opts.model))
  const fastModel = remapRetiredAnthropicModelId(resolveAnthropicFastModelId())
  const { system, messages } = toAnthropicMessages(opts.messages)

  const baseRequest = {
    messages,
    max_tokens: opts.max_tokens ?? 1500,
    temperature: opts.temperature ?? 0.7,
    ...(system ? { system } : {}),
  }

  async function callModel(model: string): Promise<string> {
    const resolvedModel = remapRetiredAnthropicModelId(model)
    const m = resolvedModel.toLowerCase()
    const omitTemperature = m.includes("opus")
    const request: Anthropic.MessageCreateParams = {
      model: resolvedModel,
      messages: baseRequest.messages,
      max_tokens: baseRequest.max_tokens,
      ...(baseRequest.system ? { system: baseRequest.system } : {}),
      ...(!omitTemperature ? { temperature: opts.temperature ?? 0.7 } : {}),
    }
    const response = await client!.messages.create(request)

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim()

    if (!text) throw new Error("Anthropic returned empty response")
    if (opts.response_format?.type === "json_object") {
      const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (fence?.[1]) return fence[1].trim()
    }
    return text
  }

  const fallbackModels = [
    primaryModel,
    fastModel,
    "claude-sonnet-4-6",
    "claude-haiku-4-5",
  ].filter((model, index, list) => list.indexOf(model) === index)

  let lastError = "unknown"
  for (let index = 0; index < fallbackModels.length; index += 1) {
    const model = fallbackModels[index]!
    try {
      const content = await callModel(model)
      return { content, modelUsed: model, usedFallback: index > 0 }
    } catch (err) {
      lastError = (err as Error)?.message ?? "unknown"
      const retryable =
        /does not exist|do not have access|not found|404|deprecated|retired|invalid model/i.test(
          lastError,
        )
      if (!retryable && index === 0) {
        throw new Error(`Anthropic model failed: ${lastError}`)
      }
      console.warn(`[Anthropic] ${model} failed (${lastError})`)
    }
  }

  throw new Error(`Anthropic model failed: ${lastError}`)
}

/** Minimal connectivity test for health checks */
export async function pingAnthropic(): Promise<{
  ok: boolean
  model: string
  elapsedMs: number
  error?: string
}> {
  const start = Date.now()
  const model = resolveAnthropicFastModelId()
  try {
    const result = await createWithAnthropic({
      model,
      messages: [{ role: "user", content: "Reply with exactly: OK" }],
      max_tokens: 16,
      temperature: 0,
    })
    return {
      ok: result.content.toUpperCase().includes("OK"),
      model: result.modelUsed,
      elapsedMs: Date.now() - start,
    }
  } catch (err) {
    return {
      ok: false,
      model,
      elapsedMs: Date.now() - start,
      error: (err as Error)?.message ?? String(err),
    }
  }
}
