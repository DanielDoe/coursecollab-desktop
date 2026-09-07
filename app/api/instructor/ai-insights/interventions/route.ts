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
    const { hours = 6 } = await request.json()

    // Get struggling students data
    const struggles = await sql`
      SELECT 
        aitc.student_id,
        s.full_name as student_name,
        s.student_id as student_number,
        aitc.topic,
        COUNT(*) as question_count,
        ARRAY_AGG(aitc.message ORDER BY aitc.created_at DESC) as recent_questions,
        MAX(aitc.created_at) as last_question_time
      FROM ai_tutor_conversations aitc
      JOIN students s ON aitc.student_id = s.id
      WHERE aitc.created_at >= NOW() - INTERVAL '${hours} hours'
      GROUP BY aitc.student_id, s.full_name, s.student_id, aitc.topic
      HAVING COUNT(*) >= 3
      ORDER BY question_count DESC
      LIMIT 20
    `

    // Get hot topics
    const hotTopics = await sql`
      SELECT 
        topic,
        COUNT(*) as question_count,
        COUNT(DISTINCT student_id) as student_count
      FROM ai_tutor_conversations
      WHERE 
        created_at >= NOW() - INTERVAL '${hours} hours'
        AND topic IS NOT NULL
      GROUP BY topic
      ORDER BY question_count DESC
      LIMIT 10
    `

    if (struggles.length === 0 && hotTopics.length === 0) {
      return NextResponse.json({
        success: true,
        interventions: [],
        message: "No intervention recommendations at this time"
      })
    }

    // Prepare context for AI
    const context = {
      strugglingStudents: struggles.map((s: any) => ({
        name: s.student_name,
        topic: s.topic,
        questionCount: s.question_count,
        recentQuestions: s.recent_questions.slice(0, 3)
      })),
      hotTopics: hotTopics.map((t: any) => ({
        topic: t.topic,
        questionCount: t.question_count,
        studentCount: t.student_count
      }))
    }

    const systemPrompt = `You are an expert educational advisor helping an instructor plan targeted interventions for struggling students.

Your task: Analyze the student struggle patterns and hot topics, then recommend specific, actionable interventions.

Provide recommendations in this JSON format:
{
  "interventions": [
    {
      "type": "individual|group|class-wide",
      "priority": "urgent|high|medium|low",
      "title": "Short intervention title",
      "description": "Detailed description of the intervention",
      "targetStudents": ["student names"] or "all",
      "targetTopics": ["topics to address"],
      "suggestedActions": [
        "Specific action 1",
        "Specific action 2"
      ],
      "timing": "When to implement (e.g., 'before next lecture', 'this week')",
      "expectedOutcome": "What this will achieve",
      "effort": "low|medium|high"
    }
  ],
  "lectureRecommendations": [
    {
      "topic": "Topic to review",
      "reason": "Why this needs coverage",
      "approach": "How to present it"
    }
  ],
  "overallStrategy": "High-level recommendation for addressing current struggles"
}`

    const { content } = await createForFeature(openai, "insights", {

      messages: [
        { role: "system", content: systemPrompt },
        { 
          role: "user", 
          content: `Based on this data from the past ${hours} hours, recommend interventions:\n\n${JSON.stringify(context, null, 2)}` 
        }
      ],
      temperature: 0.5,
      max_tokens: 2500,
      response_format: { type: "json_object" }
    })

    const recommendations = JSON.parse(content || "{}")

    // Store recommendations
    await sql`
      INSERT INTO ai_instructor_insights (
        insight_type,
        data,
        created_at
      ) VALUES (
        'interventions',
        ${JSON.stringify(recommendations)},
        NOW()
      )
    `

    return NextResponse.json({
      success: true,
      ...recommendations,
      generatedAt: new Date().toISOString(),
      dataSource: {
        strugglingStudents: struggles.length,
        hotTopics: hotTopics.length,
        timeRange: `Last ${hours} hours`
      }
    })

  } catch (error: any) {
    console.error("[Intervention Recommendations Error]", error)
    return NextResponse.json(
      { 
        success: false, 
        error: "Failed to generate intervention recommendations",
        details: error.message 
      },
      { status: 500 }
    )
  }
}

