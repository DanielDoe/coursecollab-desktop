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
    const { topic, materialType = "auto", days = 7 } = await request.json()

    // Get student questions about this topic
    const questions = await sql`
      SELECT 
        aitc.message,
        aitc.response,
        s.full_name as student_name,
        aitc.created_at
      FROM ai_tutor_conversations aitc
      JOIN students s ON aitc.student_id = s.id
      WHERE 
        aitc.created_at >= NOW() - make_interval(days => ${days})
        AND aitc.topic = ${topic}
      ORDER BY aitc.created_at DESC
      LIMIT 50
    `

    if (questions.length === 0) {
      return NextResponse.json({
        success: true,
        materials: [],
        message: `No recent questions for topic: ${topic}`
      })
    }

    const systemPrompt = `You are an expert C++ educator creating supplementary learning materials.

Your task: Generate high-quality supplementary materials based on student questions.

Material types:
- Practice Problems: Coding exercises with solutions
- Concept Guides: Clear explanations with examples
- Cheat Sheets: Quick reference with syntax
- Step-by-Step Tutorials: Detailed walkthroughs
- Common Mistakes Guide: What to avoid

Provide materials in this JSON format:
{
  "materials": [
    {
      "type": "practice_problems|concept_guide|cheat_sheet|tutorial|mistakes_guide",
      "title": "Material title",
      "description": "What this material covers",
      "content": "Full material content (formatted with markdown)",
      "difficulty": "beginner|intermediate|advanced",
      "estimatedTime": "X minutes",
      "learningObjectives": [
        "Objective 1",
        "Objective 2"
      ],
      "targetAudience": "Who this helps most"
    }
  ],
  "usageRecommendations": {
    "whenToDistribute": "Best time to share these materials",
    "deliveryMethod": "How to present them",
    "followUp": "What to do after students review"
  }
}`

    const analysisData = {
      topic,
      materialType,
      questionCount: questions.length,
      studentQuestions: questions.map((q: any) => ({
        question: q.message,
        context: q.response.substring(0, 200) // AI's response for context
      }))
    }

    const { content } = await createForFeature(openai, "content_tools", {

      messages: [
        { role: "system", content: systemPrompt },
        { 
          role: "user", 
          content: `Create supplementary materials for ${topic}. Student questions show they need help with:\n\n${JSON.stringify(analysisData, null, 2)}\n\nGenerate 3-5 different materials addressing these questions.` 
        }
      ],
      temperature: 0.6,
      max_tokens: 4000,
      response_format: { type: "json_object" }
    })

    const generated = JSON.parse(content || "{}")

    // Store materials
    await sql`
      INSERT INTO ai_instructor_insights (
        insight_type,
        data,
        created_at
      ) VALUES (
        'supplementary_materials',
        ${JSON.stringify({ topic, materialType, ...generated })},
        NOW()
      )
    `

    return NextResponse.json({
      success: true,
      topic,
      ...generated,
      metadata: {
        basedOnQuestions: questions.length,
        timeRange: `Last ${days} days`,
        generatedAt: new Date().toISOString()
      }
    })

  } catch (error: any) {
    console.error("[Supplementary Materials Error]", error)
    return NextResponse.json(
      { 
        success: false, 
        error: "Failed to generate materials",
        details: error.message 
      },
      { status: 500 }
    )
  }
}

