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
    const { days = 7, topic = null } = await request.json()
    const daysInt = Math.max(1, Math.min(365, Number(days) || 7))
    const topicParam = topic && String(topic).trim() ? String(topic).trim() : null

    // Get conversations where students might have misconceptions
    // Focus on repeated questions, confused phrasing, incorrect assumptions
    const conversations = await sql`
      SELECT 
        aitc.student_id,
        s.full_name as student_name,
        aitc.topic,
        aitc.message,
        aitc.response,
        aitc.created_at,
        (
          SELECT COUNT(*) 
          FROM ai_tutor_conversations aitc2 
          WHERE aitc2.student_id = aitc.student_id 
            AND aitc2.topic = aitc.topic
            AND aitc2.created_at >= NOW() - make_interval(days => ${daysInt})
        ) as topic_question_count
      FROM ai_tutor_conversations aitc
      JOIN students s ON aitc.student_id = s.id
      WHERE 
        aitc.created_at >= NOW() - make_interval(days => ${daysInt})
        AND (${topicParam}::text IS NULL OR aitc.topic = ${topicParam})
      ORDER BY topic_question_count DESC, aitc.created_at DESC
      LIMIT 100
    `

    if (conversations.length === 0) {
      return NextResponse.json({
        success: true,
        misconceptions: [],
        message: "No data available for misconception analysis"
      })
    }

    // Group by topic for better analysis
    const conversationsByTopic: Record<string, any[]> = {}
    conversations.forEach((conv: any) => {
      const t = conv.topic || 'General'
      if (!conversationsByTopic[t]) conversationsByTopic[t] = []
      conversationsByTopic[t].push({
        student: conv.student_name,
        question: conv.message,
        aiResponse: conv.response,
        repetitions: parseInt(conv.topic_question_count)
      })
    })

    const systemPrompt = `You are an expert C++ educator specializing in identifying student misconceptions.

Your task: Analyze student questions and AI responses to identify common misconceptions, incorrect mental models, and misunderstandings.

Look for:
- Incorrect assumptions about how C++ works
- Confused concepts (e.g., confusing pointers with references)
- Wrong mental models (e.g., thinking stack grows upward)
- Syntax misunderstandings
- Logical errors in thinking
- Repeated similar questions indicating persistent confusion

Provide analysis in this JSON format:
{
  "misconceptions": [
    {
      "topic": "Topic where misconception occurs",
      "misconception": "Clear description of the wrong belief",
      "correctConcept": "The correct understanding",
      "severity": "critical|high|medium|low",
      "prevalence": number (estimated % of students affected),
      "evidence": [
        "Example question showing this misconception"
      ],
      "correctiveStrategy": "How to address this in teaching",
      "commonlyConfusedWith": "What students mix this up with"
    }
  ],
  "topicSummary": {
    "mostProblematicTopics": ["topic1", "topic2"],
    "overallPatterns": ["Pattern 1", "Pattern 2"],
    "teachingRecommendations": ["Recommendation 1", "Recommendation 2"]
  }
}`

    const { content } = await createForFeature(openai, "insights", {

      messages: [
        { role: "system", content: systemPrompt },
        { 
          role: "user", 
          content: `Identify misconceptions in these student conversations:\n\n${JSON.stringify(conversationsByTopic, null, 2)}` 
        }
      ],
      temperature: 0.4,
      max_tokens: 3500,
      response_format: { type: "json_object" }
    })

    const analysis = JSON.parse(content || "{}")

    // Store analysis
    await sql`
      INSERT INTO ai_instructor_insights (
        insight_type,
        data,
        created_at
      ) VALUES (
        'misconception_detection',
        ${JSON.stringify(analysis)},
        NOW()
      )
    `

    return NextResponse.json({
      success: true,
      ...analysis,
      generatedAt: new Date().toISOString(),
      metadata: {
        conversationsAnalyzed: conversations.length,
        topicsAnalyzed: Object.keys(conversationsByTopic).length,
        timeRange: `Last ${days} days`
      }
    })

  } catch (error: any) {
    console.error("[Misconception Detection Error]", error)
    return NextResponse.json(
      { 
        success: false, 
        error: "Failed to detect misconceptions",
        details: error.message 
      },
      { status: 500 }
    )
  }
}

