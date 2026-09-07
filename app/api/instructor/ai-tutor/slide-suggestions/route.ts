import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { createForFeature } from "@/lib/resolve-feature-ai-model"
import OpenAI from "openai"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: NextRequest) {
  try {
    const instructorId = request.headers.get("x-instructor-id")
    
    if (!instructorId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { slideId, questions } = await request.json()

    if (!slideId || !questions || questions.length === 0) {
      return NextResponse.json({ 
        error: "Slide ID and questions are required" 
      }, { status: 400 })
    }

    // Get slide content
    const slideData = await sql`
      SELECT 
        ls.title,
        ls.content,
        ls.content_type,
        l.title as lecture_title,
        l.week
      FROM lecture_slides ls
      JOIN lectures l ON ls.lecture_id = l.id
      WHERE ls.id = ${slideId}
    `

    if (slideData.length === 0) {
      return NextResponse.json({ error: "Slide not found" }, { status: 404 })
    }

    const slide = slideData[0]

    // Use GPT-4 to analyze questions and generate improvement suggestions
    const { content } = await createForFeature(openai, "tutor", {

      messages: [
        {
          role: "system",
          content: `You are an expert instructional designer and C++ programming educator. 
          
Your task is to analyze student questions about a lecture slide and suggest concrete improvements to make the slide clearer and more effective.

Provide 3-5 specific, actionable suggestions in a JSON array of strings. Each suggestion should be concise (1-2 sentences) and implementation-focused.

Focus on:
- Clarity of explanations
- Need for visual aids (diagrams, flowcharts)
- Code examples and demonstrations
- Step-by-step breakdowns
- Common misconceptions to address
- Interactive elements or analogies`
        },
        {
          role: "user",
          content: `Slide Information:
Title: ${slide.title}
Lecture: ${slide.lecture_title} (Week ${slide.week})
Type: ${slide.content_type}
Content: ${slide.content || 'No text content'}

Student Questions (${questions.length} total):
${questions.slice(0, 10).map((q: string, i: number) => `${i + 1}. "${q}"`).join('\n')}

Please analyze these questions and provide 3-5 concrete suggestions to improve this slide.`
        }
      ],
      temperature: 0.7,
      max_tokens: 500,
      response_format: { type: "json_object" }
    })

    const result = JSON.parse(content || '{"suggestions": []}')
    const suggestions = Array.isArray(result.suggestions) ? result.suggestions : []

    return NextResponse.json({
      suggestions: {
        slide_id: slideId,
        suggestions: suggestions,
        generated_at: new Date().toISOString()
      }
    })
  } catch (error) {
    console.error("[Slide Suggestions] Error:", error)
    return NextResponse.json({ 
      error: "Failed to generate suggestions",
      suggestions: {
        suggestions: ["Unable to generate suggestions at this time. Please try again later."],
        generated_at: new Date().toISOString()
      }
    }, { status: 200 }) // Return 200 with fallback
  }
}

