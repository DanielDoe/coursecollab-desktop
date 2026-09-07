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
    const { lectureId, days = 7 } = await request.json()

    // Get lecture details
    const lecture = await sql`
      SELECT id, title, week, content
      FROM lectures
      WHERE id = ${lectureId}
    `

    if (lecture.length === 0) {
      return NextResponse.json(
        { success: false, error: "Lecture not found" },
        { status: 404 }
      )
    }

    // Get student questions related to this lecture
    const questions = await sql`
      SELECT 
        aitc.message,
        aitc.topic,
        COUNT(*) OVER (PARTITION BY aitc.topic) as topic_frequency,
        s.full_name as student_name
      FROM ai_tutor_conversations aitc
      JOIN students s ON aitc.student_id = s.id
      WHERE 
        aitc.created_at >= NOW() - make_interval(days => ${days})
        AND (
          aitc.message ILIKE '%week ${lecture[0].week}%'
          OR aitc.message ILIKE '%${lecture[0].title}%'
        )
      ORDER BY topic_frequency DESC
      LIMIT 50
    `

    // Parse lecture content (assuming JSON with slides)
    let lectureContent
    try {
      lectureContent = typeof lecture[0].content === 'string' 
        ? JSON.parse(lecture[0].content) 
        : lecture[0].content
    } catch {
      lectureContent = { slides: [] }
    }

    if (!lectureContent.slides || lectureContent.slides.length === 0) {
      return NextResponse.json({
        success: true,
        confusingSlides: [],
        message: "No slides found in lecture content"
      })
    }

    // Prepare data for AI analysis
    const analysisData = {
      lectureTitle: lecture[0].title,
      week: lecture[0].week,
      slides: lectureContent.slides.map((slide: any, idx: number) => ({
        slideNumber: idx + 1,
        title: slide.title || `Slide ${idx + 1}`,
        content: slide.content || slide.text || "",
        type: slide.type || "text"
      })),
      studentQuestions: questions.map((q: any) => ({
        question: q.message,
        topic: q.topic,
        frequency: parseInt(q.topic_frequency)
      }))
    }

    const systemPrompt = `You are an expert educational content analyzer helping improve lecture slides.

Your task: Identify which slides are confusing students based on the questions they're asking.

Analysis criteria:
1. Match student questions to specific slides
2. Identify slides with unclear explanations
3. Detect missing context or examples
4. Find overly technical or jargon-heavy slides
5. Spot slides that skip important steps

Provide analysis in this JSON format:
{
  "confusingSlides": [
    {
      "slideNumber": number,
      "slideTitle": "Title",
      "confusionLevel": "high|medium|low",
      "issues": [
        "Specific issue 1",
        "Specific issue 2"
      ],
      "studentQuestions": [
        "Related question from students"
      ],
      "improvements": [
        {
          "suggestion": "Specific improvement",
          "priority": "high|medium|low",
          "implementation": "How to fix it"
        }
      ],
      "missingElements": ["Example", "Diagram", "Step-by-step"],
      "difficulty": "Why this is confusing"
    }
  ],
  "overallInsights": {
    "mostConfusingConcepts": ["concept1", "concept2"],
    "lectureStrengths": ["strength1", "strength2"],
    "generalRecommendations": ["recommendation1", "recommendation2"]
  }
}`

    const { content } = await createForFeature(openai, "content_tools", {

      messages: [
        { role: "system", content: systemPrompt },
        { 
          role: "user", 
          content: `Analyze these lecture slides and student questions:\n\n${JSON.stringify(analysisData, null, 2)}` 
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
        'confusing_slides',
        ${JSON.stringify({ lectureId, ...analysis })},
        NOW()
      )
    `

    return NextResponse.json({
      success: true,
      ...analysis,
      lectureTitle: lecture[0].title,
      week: lecture[0].week,
      totalSlides: lectureContent.slides.length,
      questionsAnalyzed: questions.length
    })

  } catch (error: any) {
    console.error("[Confusing Slides Analysis Error]", error)
    return NextResponse.json(
      { 
        success: false, 
        error: "Failed to analyze slides",
        details: error.message 
      },
      { status: 500 }
    )
  }
}

