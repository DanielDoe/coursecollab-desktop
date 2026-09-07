import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { createForFeature } from "@/lib/resolve-feature-ai-model"
import OpenAI from "openai"

export const dynamic = "force-dynamic"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

export async function POST(request: NextRequest) {
  try {
    const { days = 7, minQuestions = 3 } = await request.json()

    // Get frequently asked questions grouped by similarity
    const conversations = await sql`
      SELECT 
        aitc.message,
        aitc.response,
        aitc.topic,
        COUNT(*) OVER (PARTITION BY aitc.topic) as topic_frequency
      FROM ai_tutor_conversations aitc
      WHERE 
        aitc.created_at >= NOW() - make_interval(days => ${days})
        AND aitc.topic IS NOT NULL
        AND aitc.topic != ''
      ORDER BY topic_frequency DESC, aitc.created_at DESC
      LIMIT 50
    `

    if (conversations.length === 0) {
      return NextResponse.json({
        success: true,
        faqs: [],
        message: "Not enough data to generate FAQs"
      })
    }

    // Prepare data for AI
    const questionData = conversations.map((c: any, idx: number) => ({
      topic: c.topic,
      question: c.message,
      answer: c.response
    }))

    const systemPrompt = `You are an expert C++ instructor creating a FAQ document for students.

Your task: Analyze the provided student questions and AI responses, then create a comprehensive FAQ that:
1. Groups similar questions together
2. Provides clear, concise answers
3. Uses student-friendly language
4. Includes code examples where appropriate
5. Prioritizes the most frequently asked topics

Generate FAQs in this JSON format:
{
  "faqs": [
    {
      "category": "Topic category (e.g., Pointers, Loops, Classes)",
      "question": "Clear, well-formed question",
      "answer": "Comprehensive answer with examples if needed",
      "relatedTopics": ["topic1", "topic2"],
      "difficulty": "beginner|intermediate|advanced",
      "frequency": number (estimated times asked)
    }
  ],
  "summary": "Brief overview of the FAQ document"
}`

    const { content } = await createForFeature(openai, "insights", {

      messages: [
        { role: "system", content: systemPrompt },
        { 
          role: "user", 
          content: `Create a FAQ from these student interactions:\n\n${JSON.stringify(questionData, null, 2)}\n\nGenerate 10-15 most important FAQs.` 
        }
      ],
      temperature: 0.4,
      max_tokens: 3000,
      response_format: { type: "json_object" }
    })

    const faqData = JSON.parse(content || "{}")

    // Store FAQs
    await sql`
      INSERT INTO ai_instructor_insights (
        insight_type,
        data,
        created_at
      ) VALUES (
        'auto_faq',
        ${JSON.stringify(faqData)},
        NOW()
      )
    `

    return NextResponse.json({
      success: true,
      ...faqData,
      generatedAt: new Date().toISOString()
    })

  } catch (error: any) {
    console.error("[Auto FAQ Generation Error]", error)
    return NextResponse.json(
      { 
        success: false, 
        error: "Failed to generate FAQs",
        details: error.message 
      },
      { status: 500 }
    )
  }
}

