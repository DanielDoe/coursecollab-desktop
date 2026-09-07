/**
 * Unified vision model calls for circuit / multi-part grading.
 * Routes to Anthropic (Claude) or OpenAI Responses API based on model id.
 */

import OpenAI from "openai"
import Anthropic from "@anthropic-ai/sdk"
import { shouldUseAnthropic } from "@/lib/ai-env"
import { getAnthropicClient } from "@/lib/anthropic-chat"
import { resolveOpenAiApiFallbackModel } from "@/lib/ai-openai-models"

export type VisionContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } }

function parseDataUrl(dataUrl: string): { mediaType: string; data: string } | null {
  const match = /^data:([^;]+);base64,(.+)$/i.exec(dataUrl.trim())
  if (!match) return null
  return { mediaType: match[1], data: match[2] }
}

async function callOpenAiVision(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userParts: VisionContentPart[],
  timeoutMs = 180000,
): Promise<string> {
  const openai = new OpenAI({ apiKey })
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const input = [
      { role: "developer" as const, content: systemPrompt },
      {
        role: "user" as const,
        content: userParts.map((p) => {
          if (p.type === "text") return { type: "input_text" as const, text: p.text }
          return { type: "input_image" as const, image_url: p.image_url.url }
        }),
      },
    ]

    const response = await openai.responses.create(
      {
        model,
        input,
        reasoning: { effort: "low" },
        max_output_tokens: 8192,
      },
      { signal: controller.signal },
    )
    clearTimeout(timeoutId)
    const text = (response.output_text ?? "").trim()
    if (!text) throw new Error("Empty model response")
    return text
  } catch (e) {
    clearTimeout(timeoutId)
    throw e
  }
}

async function callAnthropicVision(
  model: string,
  systemPrompt: string,
  userParts: VisionContentPart[],
): Promise<string> {
  const client = getAnthropicClient()
  if (!client) throw new Error("ANTHROPIC_API_KEY is not configured")

  const content: Anthropic.MessageParam["content"] = []
  for (const part of userParts) {
    if (part.type === "text") {
      content.push({ type: "text", text: part.text })
      continue
    }
    const parsed = parseDataUrl(part.image_url.url)
    if (!parsed) {
      throw new Error("Vision image must be a base64 data URL for Anthropic")
    }
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: parsed.mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
        data: parsed.data,
      },
    })
  }

  const response = await client.messages.create({
    model,
    max_tokens: 8192,
    temperature: 0.2,
    system: systemPrompt,
    messages: [{ role: "user", content }],
  })

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim()

  if (!text) throw new Error("Anthropic returned empty vision response")
  return text
}

export type VisionChatResult = {
  text: string
  modelUsed: string
  usedFallback: boolean
}

/**
 * Call a vision-capable model with automatic fallback.
 * Claude models use Anthropic Messages API; OpenAI models use Responses API.
 */
export async function callVisionModelWithFallback(
  apiKey: string,
  primaryModel: string,
  systemPrompt: string,
  userParts: VisionContentPart[],
  fallbackModel: string = resolveOpenAiApiFallbackModel(),
): Promise<VisionChatResult> {
  try {
    if (shouldUseAnthropic(primaryModel)) {
      const text = await callAnthropicVision(primaryModel, systemPrompt, userParts)
      return { text, modelUsed: primaryModel, usedFallback: false }
    }
    const text = await callOpenAiVision(apiKey, primaryModel, systemPrompt, userParts)
    return { text, modelUsed: primaryModel, usedFallback: false }
  } catch (primaryErr) {
    if (fallbackModel && fallbackModel !== primaryModel) {
      console.warn("[Vision AI] Primary model failed, trying fallback:", primaryErr)
      try {
        if (shouldUseAnthropic(fallbackModel)) {
          const text = await callAnthropicVision(fallbackModel, systemPrompt, userParts)
          return { text, modelUsed: fallbackModel, usedFallback: true }
        }
        const text = await callOpenAiVision(apiKey, fallbackModel, systemPrompt, userParts)
        return { text, modelUsed: fallbackModel, usedFallback: true }
      } catch (fallbackErr) {
        console.error("[Vision AI] Fallback failed:", fallbackErr)
        throw fallbackErr
      }
    }
    throw primaryErr
  }
}
