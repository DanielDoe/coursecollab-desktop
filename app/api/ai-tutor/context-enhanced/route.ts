import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { createForFeature } from "@/lib/resolve-feature-ai-model"
import OpenAI from "openai"
import { cacheResponse } from "@/lib/ai-cache"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

export const dynamic = "force-dynamic"

/**
 * Estimate token count for messages
 */
function estimateTokens(messages: any[]): number {
  const totalChars = messages.reduce((sum, msg) => 
    sum + (msg.content?.length || 0), 0
  )
  // Rough estimate: 1 token ≈ 4 characters
  return Math.ceil(totalChars / 4)
}

/**
 * Compress conversation history using AI summarization
 */
async function compressConversationHistory(messages: any[]): Promise<any[]> {
  if (messages.length <= 10) {
    return messages
  }

  // Split into: [older half to summarize] + [recent half to keep]
  const splitPoint = Math.floor(messages.length / 2)
  const toSummarize = messages.slice(0, splitPoint)
  const toKeep = messages.slice(splitPoint)

  try {
    // Summarize older half
    const { content: summary } = await createForFeature(openai, "tutor", {

      messages: [
        {
          role: "system",
          content: "Summarize this conversation, preserving key concepts, topics discussed, and important context. Be concise but comprehensive."
        },
        {
          role: "user",
          content: `Summarize this conversation:\n\n${toSummarize.map(m => `${m.role}: ${m.content}`).join('\n\n')}`
        }
      ],
      temperature: 0.3,
      max_tokens: 500
    })

    // Return: [summary as system message] + [recent messages]
    return [
      {
        role: "system",
        content: `Previous conversation summary: ${summary}`
      },
      ...toKeep
    ]
  } catch (error) {
    console.error('[Context Compression Error]', error)
    // Fallback: just return recent messages
    return messages.slice(-10)
  }
}

/**
 * Context-Enhanced AI Endpoint
 * Maintains unlimited conversation history with smart compression
 */
export async function POST(request: NextRequest) {
  try {
    const { message, studentId, context = {} } = await request.json()

    if (!message || !message.trim()) {
      return NextResponse.json(
        { success: false, error: "Message is required" },
        { status: 400 }
      )
    }


    // 1. Get ALL recent conversation history for this student
    const conversationHistory = await sql`
      SELECT message, response, topic, created_at
      FROM ai_tutor_conversations
      WHERE student_id = ${studentId}
        AND created_at >= NOW() - INTERVAL '7 days'
      ORDER BY created_at ASC
      LIMIT 100
    `


    // 2. Build messages array with full history
    let messages: any[] = [
      {
        role: "system",
        content: `You are an expert C++ programming tutor. You have been helping this student learn C++ over multiple conversations. Use context from previous discussions to provide more personalized, relevant help.`
      }
    ]

    // Add conversation history
    conversationHistory.forEach((conv: any) => {
      messages.push(
        { role: "user", content: conv.message },
        { role: "assistant", content: conv.response }
      )
    })

    // Add current message
    messages.push({ role: "user", content: message })

    // 3. Check if context is too large
    const estimatedTokenCount = estimateTokens(messages)

    if (estimatedTokenCount > 12000) {
      // Compress to fit within limits
      messages = await compressConversationHistory(messages)
      const newTokenCount = estimateTokens(messages)
    }

    // 4. Generate response with full context
    const startTime = Date.now()

    const { content: response } = await createForFeature(openai, "tutor", {

      messages,
      temperature: 0.7,
      max_tokens: 1500
    })

    const responseTime = Date.now() - startTime

    // 5. Auto-detect topic
    let detectedTopic = context.topic || 'General'
    const topicKeywords: Record<string, string[]> = {
      'Pointers': ['pointer', 'address', 'dereference'],
      'Loops': ['loop', 'for', 'while', 'iteration'],
      'Arrays': ['array', 'index', 'element'],
      'Functions': ['function', 'parameter', 'return'],
      'Classes': ['class', 'object', 'constructor'],
      'Memory Management': ['new', 'delete', 'malloc', 'free'],
    }

    for (const [topic, keywords] of Object.entries(topicKeywords)) {
      if (keywords.some(kw => message.toLowerCase().includes(kw) || response.toLowerCase().includes(kw))) {
        detectedTopic = topic
        break
      }
    }

    // 6. Save conversation
    const conversationId = await sql`
      INSERT INTO ai_tutor_conversations (
        student_id, message, response, topic, response_time, created_at
      ) VALUES (
        ${studentId},
        ${message},
        ${response},
        ${detectedTopic},
        ${responseTime},
        NOW()
      )
      RETURNING id
    `

    // 7. Cache the response
    await cacheResponse(message, response, detectedTopic)

    return NextResponse.json({
      success: true,
      response,
      topic: detectedTopic,
      context: {
        previousMessages: conversationHistory.length,
        compressed: estimatedTokenCount > 12000,
        tokensUsed: 0
      }
    })

  } catch (error: any) {
    console.error("[Context-Enhanced Error]", error)
    return NextResponse.json(
      { 
        success: false, 
        error: "Failed to generate response",
        details: error.message 
      },
      { status: 500 }
    )
  }
}

