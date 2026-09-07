import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { createForFeature } from "@/lib/resolve-feature-ai-model"
import { resolveCoraDynamicRoute } from "@/lib/cora/ai/dynamic-router"
import OpenAI from "openai"
import { getCachedResponse, cacheResponse } from "@/lib/ai-cache"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export const dynamic = "force-dynamic"

/**
 * Multi-model AI endpoint — routes via shared Cora dynamic router
 * (Claude for code, ChatGPT for creative/thinking; cheap→expensive by complexity).
 */
export async function POST(request: NextRequest) {
  try {
    const {
      message,
      studentId,
      context = {},
      conversationHistory = [],
      domainHint = null,
    } = await request.json()

    if (!message || !message.trim()) {
      return NextResponse.json(
        { success: false, error: "Message is required" },
        { status: 400 },
      )
    }

    const cached = await getCachedResponse(message, context.topic)
    if (cached) {
      return NextResponse.json({
        success: true,
        response: cached,
        cached: true,
        modelUsed: "cache",
        complexity: "n/a",
        routing: { provider: "cache", reason: "response cache hit" },
      })
    }

    const route = resolveCoraDynamicRoute({
      message: String(message),
      conversationHistory,
      domainHint,
      forAgentTools: false,
    })

    const depthHint =
      route.complexity === "simple"
        ? "Provide a concise, clear answer."
        : route.complexity === "complex"
          ? "Provide a detailed, thorough explanation with examples and edge cases."
          : "Provide a helpful, balanced explanation."

    const domainHintLine =
      route.domain === "code"
        ? "Prefer precise code, debugging steps, and algorithms."
        : route.domain === "creative"
          ? "Be imaginative and design-oriented while staying academically useful."
          : "Teach clearly and adapt to the student's level."

    const messages: Array<{ role: string; content: string }> = [
      {
        role: "system",
        content: `You are Cora, an expert academic tutor. ${depthHint} ${domainHintLine}`,
      },
    ]

    const recentHistory = conversationHistory.slice(-10)
    recentHistory.forEach((msg: { role?: string; content?: string }) => {
      messages.push({
        role: msg.role === "student" ? "user" : "assistant",
        content: String(msg.content ?? ""),
      })
    })
    messages.push({ role: "user", content: message })

    const startTime = Date.now()

    const { content: response, modelUsed } = await createForFeature(openai, route.feature, {
      model: route.modelId,
      aiModel: route.aiModelPreset,
      messages,
      temperature: route.temperature,
      max_tokens: route.maxTokens,
    })

    const responseTime = Date.now() - startTime
    const tokensUsed = 0

    let detectedTopic = context.topic || "General"
    const topicKeywords: Record<string, string[]> = {
      Pointers: ["pointer", "address", "dereference", "*ptr", "&"],
      Loops: ["loop", "for", "while", "iteration"],
      Arrays: ["array", "index", "[]", "element"],
      Functions: ["function", "parameter", "return", "argument"],
      Classes: ["class", "object", "constructor", "member"],
      "Memory Management": ["new", "delete", "malloc", "free", "memory"],
    }

    for (const [topic, keywords] of Object.entries(topicKeywords)) {
      if (keywords.some((kw) => message.toLowerCase().includes(kw))) {
        detectedTopic = topic
        break
      }
    }

    let conversationId: { id: number }[] = []
    try {
      conversationId = await sql`
        INSERT INTO ai_tutor_conversations (
          student_id, message, response, topic, response_time, created_at
        ) VALUES (
          ${studentId || null},
          ${message},
          ${response},
          ${detectedTopic},
          ${responseTime},
          NOW()
        )
        RETURNING id
      `
    } catch (saveError) {
      console.warn("[Multi-Model] Failed to save conversation:", saveError)
    }

    try {
      await cacheResponse(message, response, detectedTopic)
    } catch (cacheError) {
      console.warn("[Multi-Model] Failed to cache response:", cacheError)
    }

    const modelLabel = modelUsed || route.modelId
    const estimatedCost =
      tokensUsed *
      (modelLabel.includes("nano") || modelLabel.includes("haiku")
        ? 0.00000125
        : modelLabel.includes("mini") || modelLabel.includes("sonnet")
          ? 0.0000045
          : 0.000015)

    if (conversationId[0]?.id) {
      try {
        await sql`
          INSERT INTO ai_tutor_api_usage (
            conversation_id,
            model_used,
            tokens_used,
            estimated_cost,
            response_time_ms
          ) VALUES (
            ${conversationId[0].id},
            ${modelLabel},
            ${tokensUsed},
            ${estimatedCost},
            ${responseTime}
          )
        `
      } catch (usageError) {
        console.error("[Multi-Model] Failed to log usage:", usageError)
      }
    }

    return NextResponse.json({
      success: true,
      response,
      topic: detectedTopic,
      modelUsed: modelLabel,
      complexity: route.complexity,
      domain: route.domain,
      provider: route.provider,
      routing: {
        provider: route.provider,
        domain: route.domain,
        complexity: route.complexity,
        modelId: modelLabel,
        reason: route.reason,
      },
      responseTime,
      conversationId: conversationId[0]?.id ?? null,
    })
  } catch (error) {
    console.error("[Multi-Model] Error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to generate response" },
      { status: 500 },
    )
  }
}
