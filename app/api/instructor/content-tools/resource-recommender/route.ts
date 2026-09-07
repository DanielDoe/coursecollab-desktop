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
    const { topic, days = 14 } = await request.json()

    // Get student questions about this topic
    const questions = await sql`
      SELECT 
        aitc.message,
        aitc.topic,
        COUNT(*) as frequency
      FROM ai_tutor_conversations aitc
      WHERE 
        aitc.created_at >= NOW() - make_interval(days => ${days})
        AND aitc.topic = ${topic}
      GROUP BY aitc.message, aitc.topic
      ORDER BY frequency DESC
      LIMIT 30
    `

    const systemPrompt = `You are an expert C++ educator with deep knowledge of educational resources.

Your task: Recommend high-quality external resources (websites, videos, books, tools) for students learning this topic.

Recommendation criteria:
1. Free and accessible (prefer)
2. Beginner-friendly for foundational topics
3. Authoritative and accurate
4. Interactive when possible
5. Well-maintained and current

Provide recommendations in this JSON format:
{
  "recommendations": [
    {
      "type": "website|video|book|tool|interactive_tutorial|documentation",
      "title": "Resource name",
      "url": "Full URL (if online resource)",
      "description": "What this resource offers",
      "difficulty": "beginner|intermediate|advanced",
      "format": "text|video|interactive|reference",
      "estimatedTime": "How long to complete/review",
      "strengths": [
        "What makes this resource great"
      ],
      "bestFor": "When to use this resource",
      "cost": "free|paid",
      "priority": "essential|recommended|optional"
    }
  ],
  "learningPath": {
    "beginner": ["Resource 1", "Resource 2"],
    "intermediate": ["Resource 3"],
    "advanced": ["Resource 4"]
  },
  "usageGuidance": "How instructor should integrate these resources"
}`

    const analysisData = {
      topic,
      commonQuestions: questions.map((q: any) => ({
        question: q.message,
        frequency: parseInt(q.frequency)
      }))
    }

    const { content } = await createForFeature(openai, "content_tools", {

      messages: [
        { role: "system", content: systemPrompt },
        { 
          role: "user", 
          content: `Recommend external learning resources for ${topic}. Students are asking:\n\n${JSON.stringify(analysisData, null, 2)}\n\nSuggest 8-12 high-quality resources.` 
        }
      ],
      temperature: 0.5,
      max_tokens: 3500,
      response_format: { type: "json_object" }
    })

    const resources = JSON.parse(content || "{}")

    // Store recommendations
    await sql`
      INSERT INTO ai_instructor_insights (
        insight_type,
        data,
        created_at
      ) VALUES (
        'resource_recommendations',
        ${JSON.stringify({ topic, ...resources })},
        NOW()
      )
    `

    return NextResponse.json({
      success: true,
      topic,
      ...resources,
      metadata: {
        basedOnQuestions: questions.length,
        generatedAt: new Date().toISOString()
      }
    })

  } catch (error: any) {
    console.error("[Resource Recommender Error]", error)
    return NextResponse.json(
      { 
        success: false, 
        error: "Failed to generate resource recommendations",
        details: error.message 
      },
      { status: 500 }
    )
  }
}

