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
    const { studentId, topic, questionCount, recentQuestions } = await request.json()

    // Get student info
    const student = await sql`
      SELECT 
        s.full_name,
        s.student_id,
        s.email,
        s.section
      FROM students s
      WHERE s.id = ${studentId}
    `

    if (student.length === 0) {
      return NextResponse.json(
        { success: false, error: "Student not found" },
        { status: 404 }
      )
    }

    // Get student's quiz performance on related topics
    const performance = await sql`
      SELECT 
        AVG(score) as avg_score,
        COUNT(*) as quizzes_taken
      FROM student_assessments
      WHERE 
        student_id = ${studentId}
        AND assessment_type = 'quiz'
        AND submitted_at >= NOW() - INTERVAL '30 days'
    `

    const systemPrompt = `You are a supportive, encouraging C++ instructor writing a personalized email to a struggling student.

Tone: Warm, understanding, motivating (NOT discouraging)

Email requirements:
1. Acknowledge their effort (asking ${questionCount} questions shows engagement)
2. Normalize struggle ("This topic is challenging for many students")
3. Provide specific, actionable next steps
4. Offer concrete support (office hours, resources)
5. Encourage without being condescending
6. Keep it concise (3-4 paragraphs)

Generate email in this JSON format:
{
  "email": {
    "subject": "Email subject line",
    "greeting": "Hi [Name],",
    "body": "Full email body (3-4 paragraphs)",
    "closing": "Encouraging closing statement",
    "signature": "Dr./Professor [Instructor Name]",
    "actionItems": [
      "Specific action student should take"
    ]
  },
  "followUpRecommendations": {
    "when": "When to follow up",
    "what": "What to check"
  }
}`

    const studentData = {
      name: student[0].full_name,
      topic,
      questionCount,
      recentQuestions: recentQuestions?.slice(0, 3) || [],
      avgScore: parseFloat(performance[0]?.avg_score || 0),
      quizzesTaken: parseInt(performance[0]?.quizzes_taken || 0)
    }

    const { content } = await createForFeature(openai, "insights", {

      messages: [
        { role: "system", content: systemPrompt },
        { 
          role: "user", 
          content: `Write an encouraging email to ${studentData.name} who has asked ${questionCount} questions about ${topic}. Recent questions:\n\n${recentQuestions?.join('\n')}\n\nAverage quiz score: ${studentData.avgScore}%` 
        }
      ],
      temperature: 0.7,
      max_tokens: 1500,
      response_format: { type: "json_object" }
    })

    const emailData = JSON.parse(content || "{}")

    // Log that email was generated (actual sending would be separate)
    await sql`
      INSERT INTO ai_instructor_insights (
        insight_type,
        data,
        created_at
      ) VALUES (
        'auto_email',
        ${JSON.stringify({ 
          studentId, 
          topic, 
          questionCount,
          ...emailData 
        })},
        NOW()
      )
    `

    return NextResponse.json({
      success: true,
      student: {
        name: student[0].full_name,
        email: student[0].email,
        studentId: student[0].student_id
      },
      ...emailData,
      metadata: {
        topic,
        questionCount,
        generatedAt: new Date().toISOString()
      }
    })

  } catch (error: any) {
    console.error("[Auto-Email Generation Error]", error)
    return NextResponse.json(
      { 
        success: false, 
        error: "Failed to generate email",
        details: error.message 
      },
      { status: 500 }
    )
  }
}

