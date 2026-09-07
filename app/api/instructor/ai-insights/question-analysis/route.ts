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
    const { hours = 24, topic = null } = await request.json()

    // Fetch recent student questions
    const topicFilter = topic ? sql`AND topic = ${topic}` : sql``
    
    const questions = await sql`
      SELECT 
        aitc.message,
        aitc.topic,
        s.full_name as student_name,
        aitc.created_at
      FROM ai_tutor_conversations aitc
      JOIN students s ON aitc.student_id = s.id
      WHERE aitc.created_at >= NOW() - INTERVAL '${hours} hours'
        ${topicFilter}
      ORDER BY aitc.created_at DESC
      LIMIT 100
    `

    if (questions.length === 0) {
      return NextResponse.json({
        success: true,
        analysis: {
          summary: "No student questions found in the specified time range.",
          commonConfusions: [],
          keyPatterns: [],
          recommendedActions: []
        }
      })
    }

    // Prepare questions for AI analysis
    const questionTexts = questions.map((q: any, idx: number) => 
      `${idx + 1}. [${q.topic || 'General'}] ${q.message}`
    ).join('\n')

    // Use OpenAI to analyze questions
    const systemPrompt = `You are an expert C++ instructor analyzing student questions to identify learning patterns and confusions.

Your task: Analyze the following student questions and provide insights that will help the instructor understand:
1. What are the most common confusions or misconceptions?
2. What patterns do you see in the questions?
3. What topics need more coverage?
4. What specific actions should the instructor take?

Provide a structured analysis in the following JSON format:
{
  "summary": "Brief 2-3 sentence overview of what students are struggling with",
  "commonConfusions": [
    {
      "topic": "Topic name",
      "description": "What students are confused about",
      "severity": "high|medium|low",
      "affectedStudents": number
    }
  ],
  "keyPatterns": [
    "Pattern 1: Description",
    "Pattern 2: Description"
  ],
  "recommendedActions": [
    {
      "action": "Specific action to take",
      "priority": "high|medium|low",
      "rationale": "Why this will help"
    }
  ]
}`

    const { content: analysisText } = await createForFeature(openai, "insights", {

      messages: [
        { role: "system", content: systemPrompt },
        { 
          role: "user", 
          content: `Analyze these ${questions.length} student questions from the past ${hours} hours:\n\n${questionTexts}\n\nProvide your analysis in the specified JSON format.` 
        }
      ],
      temperature: 0.3,
      response_format: { type: "json_object" }
    })
    const analysis = JSON.parse(analysisText)

    // Store the analysis for future reference
    await sql`
      INSERT INTO ai_instructor_insights (
        insight_type,
        data,
        created_at
      ) VALUES (
        'question_analysis',
        ${JSON.stringify(analysis)},
        NOW()
      )
    `

    return NextResponse.json({
      success: true,
      analysis,
      questionCount: questions.length,
      timeRange: `Last ${hours} hours`
    })

  } catch (error: any) {
    console.error("[AI Question Analysis Error]", error)
    
    // Check for OpenAI-specific errors
    if (error.message?.includes("API key")) {
      return NextResponse.json(
        { 
          success: false, 
          error: "OpenAI API key not configured"
        },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { 
        success: false, 
        error: "Failed to analyze questions",
        details: error.message 
      },
      { status: 500 }
    )
  }
}

