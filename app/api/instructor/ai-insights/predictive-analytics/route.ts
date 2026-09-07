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
    const { examTopic = "general", days = 14 } = await request.json()

    // Gather comprehensive student performance data
    const studentData = await sql`
      WITH ai_usage AS (
        SELECT 
          student_id,
          COUNT(*) as total_questions,
          COUNT(DISTINCT topic) as topics_covered,
          COUNT(DISTINCT DATE(created_at)) as active_days,
          AVG(
            (SELECT COUNT(*) 
             FROM ai_tutor_conversations aitc2 
             WHERE aitc2.student_id = aitc.student_id 
               AND aitc2.topic = aitc.topic
            )
          ) as avg_questions_per_topic
        FROM ai_tutor_conversations aitc
        WHERE created_at >= NOW() - make_interval(days => ${days})
        GROUP BY student_id
      ),
      quiz_performance AS (
        SELECT 
          student_id,
          AVG(score) as avg_quiz_score,
          COUNT(*) as quizzes_taken
        FROM student_assessments
        WHERE assessment_type = 'quiz'
          AND submitted_at >= NOW() - make_interval(days => ${days})
        GROUP BY student_id
      ),
      topic_mastery AS (
        SELECT 
          student_id,
          AVG(mastery_percentage) as avg_mastery
        FROM ai_tutor_topic_mastery
        GROUP BY student_id
      )
      SELECT 
        s.id,
        s.full_name,
        s.student_id,
        s.section,
        COALESCE(ai.total_questions, 0) as ai_questions,
        COALESCE(ai.topics_covered, 0) as topics_covered,
        COALESCE(ai.active_days, 0) as active_days,
        COALESCE(ai.avg_questions_per_topic, 0) as avg_questions_per_topic,
        COALESCE(qp.avg_quiz_score, 0) as avg_quiz_score,
        COALESCE(qp.quizzes_taken, 0) as quizzes_taken,
        COALESCE(tm.avg_mastery, 0) as avg_mastery
      FROM students s
      LEFT JOIN ai_usage ai ON s.id = ai.student_id
      LEFT JOIN quiz_performance qp ON s.id = qp.student_id
      LEFT JOIN topic_mastery tm ON s.id = tm.student_id
      ORDER BY s.full_name
    `

    // Prepare data for AI analysis
    const studentMetrics = studentData.map((s: any) => ({
      name: s.full_name,
      studentId: s.student_id,
      aiEngagement: {
        totalQuestions: parseInt(s.ai_questions),
        topicsCovered: parseInt(s.topics_covered),
        activeDays: parseInt(s.active_days),
        avgQuestionsPerTopic: parseFloat(s.avg_questions_per_topic)
      },
      academicPerformance: {
        avgQuizScore: parseFloat(s.avg_quiz_score),
        quizzesTaken: parseInt(s.quizzes_taken)
      },
      mastery: parseFloat(s.avg_mastery)
    }))

    const systemPrompt = `You are an expert data scientist specializing in educational analytics and student performance prediction.

Your task: Analyze student engagement and performance data to predict exam outcomes and identify at-risk students.

Consider these risk factors:
- Low AI tutor engagement (few questions, inactive days)
- Poor quiz performance
- Low topic mastery scores
- High questions-per-topic ratio (indicates struggle)
- Few topics covered (narrow knowledge)

Provide predictions in this JSON format:
{
  "predictions": [
    {
      "studentName": "Student name",
      "studentId": "Student ID",
      "riskLevel": "high|medium|low",
      "predictedExamScore": number (0-100),
      "confidenceLevel": number (0-100),
      "riskFactors": [
        "Specific factor 1",
        "Specific factor 2"
      ],
      "strengths": [
        "Positive indicator 1",
        "Positive indicator 2"
      ],
      "recommendations": [
        "Action to help this student"
      ]
    }
  ],
  "summary": {
    "highRiskCount": number,
    "mediumRiskCount": number,
    "lowRiskCount": number,
    "keyFindings": ["Finding 1", "Finding 2"],
    "classWideRecommendations": ["Recommendation 1", "Recommendation 2"]
  }
}`

    const { content } = await createForFeature(openai, "insights", {

      messages: [
        { role: "system", content: systemPrompt },
        { 
          role: "user", 
          content: `Predict exam performance for these ${studentMetrics.length} students based on ${days} days of data:\n\n${JSON.stringify(studentMetrics, null, 2)}\n\nExam topic: ${examTopic}` 
        }
      ],
      temperature: 0.3,
      max_tokens: 4000,
      response_format: { type: "json_object" }
    })

    const predictions = JSON.parse(content || "{}")

    // Store predictions
    await sql`
      INSERT INTO ai_instructor_insights (
        insight_type,
        data,
        created_at
      ) VALUES (
        'predictive_analytics',
        ${JSON.stringify(predictions)},
        NOW()
      )
    `

    return NextResponse.json({
      success: true,
      ...predictions,
      generatedAt: new Date().toISOString(),
      metadata: {
        studentsAnalyzed: studentMetrics.length,
        dataTimeRange: `Last ${days} days`,
        examTopic
      }
    })

  } catch (error: any) {
    console.error("[Predictive Analytics Error]", error)
    return NextResponse.json(
      { 
        success: false, 
        error: "Failed to generate predictions",
        details: error.message 
      },
      { status: 500 }
    )
  }
}

