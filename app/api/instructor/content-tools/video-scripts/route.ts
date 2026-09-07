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
    const { topic, duration = 5, days = 7 } = await request.json()

    // Get student confusions about this topic
    const confusions = await sql`
      SELECT 
        aitc.message,
        COUNT(*) OVER (PARTITION BY aitc.student_id) as student_questions
      FROM ai_tutor_conversations aitc
      WHERE 
        aitc.created_at >= NOW() - make_interval(days => ${days})
        AND aitc.topic = ${topic}
      ORDER BY student_questions DESC
      LIMIT 50
    `

    const systemPrompt = `You are an expert educational video scriptwriter specializing in programming tutorials.

Your task: Write an engaging, clear video script for a ${duration}-minute tutorial video.

Script requirements:
1. Hook viewers in first 15 seconds
2. Visual cues for what to show on screen
3. Clear transitions between sections
4. Code examples with timestamps
5. Common pitfalls to address
6. Summary/recap at end
7. Conversational, friendly tone

Provide script in this JSON format:
{
  "script": {
    "title": "Video title",
    "duration": ${duration},
    "sections": [
      {
        "timestamp": "0:00-0:30",
        "title": "Hook/Introduction",
        "narration": "Exact words to say",
        "visuals": "What to show on screen",
        "codeExample": "Code snippet (if applicable)",
        "notes": "Delivery notes (pace, emphasis)"
      }
    ],
    "requirements": {
      "software": ["Required software/tools"],
      "preparation": ["What to set up before recording"]
    }
  },
  "targetAudience": "Who this video helps",
  "keyTakeaways": ["Main point 1", "Main point 2"],
  "followUpSuggestions": ["What students should do after watching"]
}`

    const confusionData = {
      topic,
      duration,
      studentQuestions: confusions.map((c: any) => c.message)
    }

    const { content } = await createForFeature(openai, "content_tools", {

      messages: [
        { role: "system", content: systemPrompt },
        { 
          role: "user", 
          content: `Write a ${duration}-minute video script for ${topic}. Students are confused about:\n\n${JSON.stringify(confusionData, null, 2)}\n\nMake sure to address their common questions.` 
        }
      ],
      temperature: 0.7,
      max_tokens: 4000,
      response_format: { type: "json_object" }
    })

    const videoScript = JSON.parse(content || "{}")

    // Store script
    await sql`
      INSERT INTO ai_instructor_insights (
        insight_type,
        data,
        created_at
      ) VALUES (
        'video_script',
        ${JSON.stringify({ topic, duration, ...videoScript })},
        NOW()
      )
    `

    return NextResponse.json({
      success: true,
      topic,
      duration,
      ...videoScript,
      metadata: {
        basedOnQuestions: confusions.length,
        generatedAt: new Date().toISOString()
      }
    })

  } catch (error: any) {
    console.error("[Video Script Generation Error]", error)
    return NextResponse.json(
      { 
        success: false, 
        error: "Failed to generate video script",
        details: error.message 
      },
      { status: 500 }
    )
  }
}

