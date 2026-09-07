import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { createForFeature } from "@/lib/resolve-feature-ai-model"
import OpenAI from "openai"
import { getCachedResponse, cacheResponse } from "@/lib/ai-cache"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

export const dynamic = "force-dynamic"

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export async function POST(request: NextRequest) {
  try {
    const { questions, studentId, context = {} } = await request.json()

    if (!Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json(
        { success: false, error: "Questions array is required" },
        { status: 400 }
      )
    }

    if (questions.length > 20) {
      return NextResponse.json(
        { success: false, error: "Maximum 20 questions per batch" },
        { status: 400 }
      )
    }


    // Process questions with rate limiting
    const results = await Promise.all(
      questions.map(async (question: string, index: number) => {
        try {
          // Stagger requests to avoid rate limits (100ms between each)
          await delay(index * 100)

          // Check cache first
          const cached = await getCachedResponse(question, context.topic)
          if (cached) {
            return {
              question,
              response: cached,
              cached: true,
              topic: context.topic || 'General',
              timestamp: new Date().toISOString()
            }
          }

          // Generate new response
          const { content: response } = await createForFeature(openai, "tutor", {

            messages: [
              {
                role: "system",
                content: `You are a C++ programming tutor. Provide concise, clear answers. ${
                  context.topic ? `Focus on: ${context.topic}` : ''
                }`
              },
              {
                role: "user",
                content: question
              }
            ],
            temperature: 0.6,
            max_tokens: 800,
          })

          // Cache the response
          await cacheResponse(question, response, context.topic)

          // Save to database
          if (studentId) {
            await sql`
              INSERT INTO ai_tutor_conversations (
                student_id, message, response, topic, created_at
              ) VALUES (
                ${studentId}, ${question}, ${response}, ${context.topic || 'General'}, NOW()
              )
            `
          }

          return {
            question,
            response,
            cached: false,
            topic: context.topic || 'General',
            timestamp: new Date().toISOString()
          }

        } catch (error: any) {
          console.error(`[Batch Error] Question ${index}:`, error)
          return {
            question,
            response: null,
            error: error.message,
            cached: false,
            timestamp: new Date().toISOString()
          }
        }
      })
    )

    const successCount = results.filter(r => r.response !== null).length
    const cacheHits = results.filter(r => r.cached).length
    const errors = results.filter(r => r.error).length


    return NextResponse.json({
      success: true,
      results,
      summary: {
        totalQuestions: questions.length,
        successful: successCount,
        cacheHits,
        newResponses: successCount - cacheHits,
        errors
      },
      processedAt: new Date().toISOString()
    })

  } catch (error: any) {
    console.error("[Batch Processing Error]", error)
    return NextResponse.json(
      { 
        success: false, 
        error: "Failed to process batch",
        details: error.message 
      },
      { status: 500 }
    )
  }
}

