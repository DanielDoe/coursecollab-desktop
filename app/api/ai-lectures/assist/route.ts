import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { createForFeature } from "@/lib/resolve-feature-ai-model"
import OpenAI from "openai"

// Check if OpenAI API key is configured
const isOpenAIConfigured = !!process.env.OPENAI_API_KEY

const openai = isOpenAIConfigured ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
}) : null

export const dynamic = "force-dynamic"
export const maxDuration = 30

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      student_id,
      lecture_id,
      slide_id,
      question,
      context
    } = body

    if (!question || !context) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    // Check if OpenAI is configured
    if (!isOpenAIConfigured || !openai) {
      console.warn("[AI Assist] OpenAI API key not configured")
      return NextResponse.json({
        response: "⚠️ AI Assistant is currently unavailable. The instructor has not configured the OpenAI API key yet. Please ask your question in the lecture comments section instead, or contact your instructor directly.",
        isConfigured: false
      })
    }

    // Build context from slide
    const slideContext = `
Lecture: ${context.slide_title}
Slide Summary: ${context.ai_summary || 'N/A'}
Slide Content: ${JSON.stringify(context.slide_content, null, 2)}
    `.trim()

    const systemPrompt = `You are an expert programming instructor and AI teaching assistant for ELEG 1304 - Computer Applications in Engineering. 
Your role is to help students understand programming concepts, algorithms, C++, MATLAB, and engineering applications.

Guidelines:
- Provide clear, concise explanations suitable for engineering freshmen
- Use analogies and real-world examples when helpful
- If the question is about code, explain line by line
- If asked for examples, provide practical, relevant code snippets
- Be encouraging and supportive
- If you don't know something, be honest and suggest resources

Current slide context:
${slideContext}`

    const { content: response } = await createForFeature(openai, "tutor", {

      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: question }
      ],
      temperature: 0.7,
      max_tokens: 1000,
    })

    // Log the interaction (create table if it doesn't exist)
    if (student_id && lecture_id) {
      try {
        await sql`
          INSERT INTO lecture_ai_interactions (
            student_id,
            lecture_id,
            slide_id,
            question,
            ai_response,
            created_at
          )
          VALUES (
            ${student_id},
            ${lecture_id},
            ${slide_id || null},
            ${question},
            ${response},
            NOW()
          )
        `
      } catch (logError: any) {
        // If table doesn't exist, just log to console (don't fail the request)
        if (logError.message?.includes('does not exist')) {
          console.log("[AI Assist] lecture_ai_interactions table doesn't exist yet - skipping logging")
        } else {
          console.error("[AI Assist] Failed to log interaction:", logError.message)
        }
      }
    }

    return NextResponse.json({ 
      response,
      isConfigured: true 
    })
  } catch (error: any) {
    console.error("[AI Assist] Error:", error)
    
    // Provide helpful error messages
    if (error.code === 'insufficient_quota') {
      return NextResponse.json({
        response: "⚠️ The AI assistant has reached its usage limit. Please contact your instructor to add more credits to the OpenAI account.",
        isConfigured: false
      })
    }
    
    if (error.code === 'invalid_api_key') {
      return NextResponse.json({
        response: "⚠️ The AI assistant is misconfigured. Please contact your instructor to update the OpenAI API key.",
        isConfigured: false
      })
    }

    return NextResponse.json({
      response: "❌ Sorry, I encountered an error. Please try again in a moment, or ask your question in the lecture comments section.",
      error: error.message
    }, { status: 200 }) // Return 200 so the message shows to user
  }
}


