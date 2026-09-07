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
    const { courseWeek = 1, days = 14 } = await request.json()

    // Define expected knowledge by week (this could be from a curriculum table)
    const expectedTopicsByWeek: Record<number, string[]> = {
      1: ["Variables", "Data Types", "Basic I/O"],
      2: ["Conditionals", "Loops", "Functions"],
      3: ["Arrays", "Strings", "Pointers Basics"],
      4: ["Pointers", "References", "Dynamic Memory"],
      5: ["Classes", "Objects", "Constructors"],
      6: ["Inheritance", "Polymorphism", "Virtual Functions"],
      7: ["Templates", "STL Containers", "Iterators"],
      8: ["File I/O", "Exception Handling", "Advanced Topics"]
    }

    const expectedTopics = expectedTopicsByWeek[courseWeek] || []

    // Get actual student knowledge from AI interactions and quizzes
    const actualKnowledge = await sql`
      WITH ai_topics AS (
        SELECT 
          topic,
          COUNT(DISTINCT student_id) as students_asking,
          COUNT(*) as total_questions,
          AVG(
            (SELECT COUNT(*) 
             FROM ai_tutor_conversations aitc2 
             WHERE aitc2.student_id = aitc.student_id 
               AND aitc2.topic = aitc.topic
            )
          ) as avg_questions_per_student
        FROM ai_tutor_conversations aitc
        WHERE 
          created_at >= NOW() - make_interval(days => ${days})
          AND topic IS NOT NULL
        GROUP BY topic
      ),
      mastery_data AS (
        SELECT 
          topic,
          AVG(mastery_percentage) as avg_mastery,
          COUNT(DISTINCT student_id) as students_with_mastery
        FROM ai_tutor_topic_mastery
        GROUP BY topic
      )
      SELECT 
        ai.topic,
        ai.students_asking,
        ai.total_questions,
        ROUND(ai.avg_questions_per_student::numeric, 2) as avg_questions_per_student,
        COALESCE(m.avg_mastery, 0) as avg_mastery,
        COALESCE(m.students_with_mastery, 0) as students_with_mastery
      FROM ai_topics ai
      LEFT JOIN mastery_data m ON ai.topic = m.topic
      ORDER BY ai.total_questions DESC
    `

    // Get total student count
    const studentCount = await sql`
      SELECT COUNT(*) as count FROM students
    `
    const totalStudents = parseInt(studentCount[0]?.count || 0)

    // Prepare analysis data
    const analysisData = {
      courseWeek,
      expectedTopics,
      totalStudents,
      actualKnowledge: actualKnowledge.map((ak: any) => ({
        topic: ak.topic,
        studentsAsking: parseInt(ak.students_asking),
        coveragePercentage: totalStudents > 0 
          ? Math.round((parseInt(ak.students_asking) / totalStudents) * 100) 
          : 0,
        totalQuestions: parseInt(ak.total_questions),
        avgQuestionsPerStudent: parseFloat(ak.avg_questions_per_student),
        avgMastery: parseFloat(ak.avg_mastery),
        studentsWithMastery: parseInt(ak.students_with_mastery)
      }))
    }

    const systemPrompt = `You are an expert curriculum analyst identifying learning gaps in a C++ course.

Your task: Compare expected knowledge (topics that should be covered by week ${courseWeek}) with actual student knowledge (based on AI interactions and mastery data) to identify gaps.

Analysis criteria:
- Topics students SHOULD know but aren't asking about (possible gap - they don't know what they don't know)
- Topics with high question counts (struggling to understand)
- Topics with low mastery despite coverage (teaching ineffective)
- Topics not in curriculum but students are asking (prerequisite gaps)

Provide analysis in this JSON format:
{
  "gaps": [
    {
      "topic": "Topic name",
      "gapType": "missing_coverage|low_mastery|prerequisite_gap|over_reliance",
      "severity": "critical|high|medium|low",
      "description": "What the gap is",
      "expectedLevel": "What students should know",
      "actualLevel": "What data shows they know",
      "impact": "How this affects learning",
      "remediation": "Specific steps to close the gap"
    }
  ],
  "insights": {
    "coveredWell": ["Topics students understand well"],
    "needsReinforcement": ["Topics needing more coverage"],
    "prerequisites Missing": ["Foundational knowledge gaps"],
    "advancedReadiness": ["Students ready for advanced topics"]
  },
  "recommendations": [
    {
      "priority": "urgent|high|medium|low",
      "action": "Specific recommendation",
      "targetTopics": ["topics"],
      "expectedOutcome": "What this will achieve"
    }
  ]
}`

    const { content } = await createForFeature(openai, "insights", {

      messages: [
        { role: "system", content: systemPrompt },
        { 
          role: "user", 
          content: `Analyze learning gaps for week ${courseWeek}:\n\n${JSON.stringify(analysisData, null, 2)}` 
        }
      ],
      temperature: 0.4,
      max_tokens: 3500,
      response_format: { type: "json_object" }
    })

    const gapAnalysis = JSON.parse(content || "{}")

    // Store analysis
    await sql`
      INSERT INTO ai_instructor_insights (
        insight_type,
        data,
        created_at
      ) VALUES (
        'learning_gap_analysis',
        ${JSON.stringify(gapAnalysis)},
        NOW()
      )
    `

    return NextResponse.json({
      success: true,
      ...gapAnalysis,
      generatedAt: new Date().toISOString(),
      metadata: {
        courseWeek,
        totalStudents,
        expectedTopicsCount: expectedTopics.length,
        analyzedTopicsCount: actualKnowledge.length,
        timeRange: `Last ${days} days`
      }
    })

  } catch (error: any) {
    console.error("[Learning Gap Analysis Error]", error)
    return NextResponse.json(
      { 
        success: false, 
        error: "Failed to analyze learning gaps",
        details: error.message 
      },
      { status: 500 }
    )
  }
}

