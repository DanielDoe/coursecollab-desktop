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

    // Get student struggles and questions about this topic
    const struggles = await sql`
      SELECT 
        aitc.message,
        aitc.response,
        aitc.topic,
        COUNT(*) OVER (PARTITION BY aitc.student_id, aitc.topic) as student_question_count,
        s.full_name as student_name
      FROM ai_tutor_conversations aitc
      JOIN students s ON aitc.student_id = s.id
      WHERE 
        aitc.created_at >= NOW() - make_interval(days => ${days})
        AND aitc.topic = ${topic}
      ORDER BY student_question_count DESC
      LIMIT 100
    `

    if (struggles.length === 0) {
      return NextResponse.json({
        success: true,
        improvements: [],
        message: `No student questions found for topic: ${topic}`
      })
    }

    // Get topic mastery data
    const mastery = await sql`
      SELECT 
        AVG(mastery_percentage) as avg_mastery,
        COUNT(DISTINCT student_id) as students_tracked
      FROM ai_tutor_topic_mastery
      WHERE topic = ${topic}
    `

    const systemPrompt = `You are an expert C++ instructor and curriculum designer.

Your task: Analyze student struggles and provide specific, actionable lecture improvements.

Focus on:
1. Common confusion patterns
2. Missing examples or explanations
3. Better teaching approaches
4. Additional practice suggestions
5. Visual aids needed

Provide improvements in this JSON format:
{
  "improvements": [
    {
      "category": "Examples|Explanations|Visuals|Practice|Analogies",
      "priority": "critical|high|medium|low",
      "title": "Short improvement title",
      "description": "Detailed description of what to add/change",
      "specificContent": "Actual example code or explanation to use",
      "rationale": "Why this will help (based on student questions)",
      "estimatedImpact": "high|medium|low",
      "implementationDifficulty": "easy|medium|hard"
    }
  ],
  "teachingStrategy": {
    "currentApproach": "What seems to be the current teaching method",
    "recommendedApproach": "Better approach based on data",
    "reasoning": "Why this change will help"
  },
  "keyInsights": [
    "Insight about what students struggle with most"
  ],
  "quickWins": [
    "Easy changes that will have immediate impact"
  ]
}`

    const analysisData = {
      topic,
      avgMastery: parseFloat(mastery[0]?.avg_mastery || 0),
      studentsTracked: parseInt(mastery[0]?.students_tracked || 0),
      totalQuestions: struggles.length,
      studentStruggles: struggles.slice(0, 30).map((s: any) => ({
        question: s.message,
        questionCount: parseInt(s.student_question_count)
      }))
    }

    const { content } = await createForFeature(openai, "content_tools", {

      messages: [
        { role: "system", content: systemPrompt },
        { 
          role: "user", 
          content: `Suggest lecture improvements for ${topic}:\n\n${JSON.stringify(analysisData, null, 2)}` 
        }
      ],
      temperature: 0.5,
      max_tokens: 3500,
      response_format: { type: "json_object" }
    })

    const suggestions = JSON.parse(content || "{}")

    // Store suggestions
    await sql`
      INSERT INTO ai_instructor_insights (
        insight_type,
        data,
        created_at
      ) VALUES (
        'lecture_improvements',
        ${JSON.stringify({ topic, ...suggestions })},
        NOW()
      )
    `

    return NextResponse.json({
      success: true,
      topic,
      ...suggestions,
      metadata: {
        avgMastery: parseFloat(mastery[0]?.avg_mastery || 0).toFixed(2),
        questionsAnalyzed: struggles.length,
        timeRange: `Last ${days} days`
      }
    })

  } catch (error: any) {
    console.error("[Lecture Improvements Error]", error)
    return NextResponse.json(
      { 
        success: false, 
        error: "Failed to generate lecture improvements",
        details: error.message 
      },
      { status: 500 }
    )
  }
}

