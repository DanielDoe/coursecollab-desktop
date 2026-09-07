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
    const { examDate, days = 14 } = await request.json()

    // Get topic difficulty and student struggles
    const topicAnalysis = await sql`
      WITH topic_metrics AS (
        SELECT 
          topic,
          COUNT(*) as question_count,
          COUNT(DISTINCT student_id) as student_count,
          AVG(response_time) as avg_response_time
        FROM ai_tutor_conversations
        WHERE 
          created_at >= NOW() - make_interval(days => ${days})
          AND topic IS NOT NULL
          AND topic != ''
        GROUP BY topic
      ),
      mastery_data AS (
        SELECT 
          topic,
          AVG(mastery_percentage) as avg_mastery,
          COUNT(DISTINCT student_id) as students_tracked
        FROM ai_tutor_topic_mastery
        GROUP BY topic
      )
      SELECT 
        tm.topic,
        tm.question_count,
        tm.student_count,
        tm.avg_response_time,
        COALESCE(md.avg_mastery, 0) as avg_mastery,
        COALESCE(md.students_tracked, 0) as students_tracked,
        -- Calculate priority score
        (
          (tm.question_count * 0.3) +
          (tm.student_count * 0.4) +
          ((100 - COALESCE(md.avg_mastery, 50)) * 0.3)
        ) as priority_score
      FROM topic_metrics tm
      LEFT JOIN mastery_data md ON tm.topic = md.topic
      ORDER BY priority_score DESC
      LIMIT 15
    `

    // Get student quiz performance
    const quizPerformance = await sql`
      SELECT 
        AVG(score) as avg_score,
        COUNT(DISTINCT student_id) as students_assessed
      FROM student_assessments
      WHERE 
        assessment_type = 'quiz'
        AND submitted_at >= NOW() - make_interval(days => ${days})
    `

    const systemPrompt = `You are an expert instructor planning targeted review sessions before an exam.

Your task: Design effective review sessions that maximize student preparation.

Session planning principles:
1. Prioritize high-impact topics (many students struggling)
2. Allocate time proportionally to difficulty
3. Include active learning strategies
4. Build in practice and assessment
5. Sequence topics logically

Provide review plan in this JSON format:
{
  "reviewSessions": [
    {
      "sessionNumber": number,
      "title": "Session title",
      "duration": "X hours",
      "format": "lecture|workshop|practice|q&a",
      "targetTopics": ["Topic 1", "Topic 2"],
      "priority": "critical|high|medium",
      "agenda": [
        {
          "time": "0-20 min",
          "activity": "Activity name",
          "description": "What to cover",
          "resources": ["Resource needed"]
        }
      ],
      "learningObjectives": [
        "Students will be able to..."
      ],
      "practiceProblems": {
        "count": number,
        "difficulty": "mixed|easy|medium|hard",
        "types": ["Problem type 1"]
      },
      "assessmentMethod": "How to check understanding",
      "homework": "Optional follow-up work"
    }
  ],
  "schedule": {
    "totalSessionsRecommended": number,
    "timing": "When to hold sessions (relative to exam)",
    "sequence": "Logical order of topics"
  },
  "materials": {
    "toPrepare": ["Material 1", "Material 2"],
    "toShare": ["Handout 1", "Practice set"]
  },
  "strategies": {
    "engagement": "How to keep students engaged",
    "differentiation": "How to support different skill levels"
  }
}`

    const analysisData = {
      examDate,
      topicAnalysis: topicAnalysis.map((t: any) => ({
        topic: t.topic,
        questionCount: parseInt(t.question_count),
        studentCount: parseInt(t.student_count),
        avgMastery: parseFloat(t.avg_mastery),
        priorityScore: parseFloat(t.priority_score)
      })),
      classPerformance: {
        avgQuizScore: parseFloat(quizPerformance[0]?.avg_score || 0),
        studentsAssessed: parseInt(quizPerformance[0]?.students_assessed || 0)
      }
    }

    const { content } = await createForFeature(openai, "insights", {

      messages: [
        { role: "system", content: systemPrompt },
        { 
          role: "user", 
          content: `Plan targeted review sessions for exam on ${examDate}. Topic analysis:\n\n${JSON.stringify(analysisData, null, 2)}` 
        }
      ],
      temperature: 0.5,
      max_tokens: 4000,
      response_format: { type: "json_object" }
    })

    const reviewPlan = JSON.parse(content || "{}")

    // Store plan
    await sql`
      INSERT INTO ai_instructor_insights (
        insight_type,
        data,
        created_at
      ) VALUES (
        'review_session_plan',
        ${JSON.stringify({ examDate, ...reviewPlan })},
        NOW()
      )
    `

    return NextResponse.json({
      success: true,
      examDate,
      ...reviewPlan,
      metadata: {
        topicsAnalyzed: topicAnalysis.length,
        dataTimeRange: `Last ${days} days`,
        generatedAt: new Date().toISOString()
      }
    })

  } catch (error: any) {
    console.error("[Review Sessions Error]", error)
    return NextResponse.json(
      { 
        success: false, 
        error: "Failed to generate review session plan",
        details: error.message 
      },
      { status: 500 }
    )
  }
}

