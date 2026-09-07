import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { createForFeature } from "@/lib/resolve-feature-ai-model"
import OpenAI from "openai"

export const dynamic = "force-dynamic"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const minStudents = parseInt(searchParams.get("minStudents") || "10")
    const hours = parseInt(searchParams.get("hours") || "24")

    // Find topics where many students are struggling
    const groupStruggles = await sql`
      SELECT 
        topic,
        COUNT(DISTINCT student_id) as student_count,
        COUNT(*) as question_count,
        ARRAY_AGG(DISTINCT s.full_name ORDER BY s.full_name) as student_names,
        ARRAY_AGG(DISTINCT s.id) as student_ids,
        MAX(aitc.created_at) as last_question,
        AVG(
          (SELECT COUNT(*) 
           FROM ai_tutor_conversations aitc2 
           WHERE aitc2.student_id = aitc.student_id 
             AND aitc2.topic = aitc.topic
          )
        ) as avg_questions_per_student
      FROM ai_tutor_conversations aitc
      JOIN students s ON aitc.student_id = s.id
      WHERE 
        aitc.created_at >= NOW() - INTERVAL '${hours} hours'
        AND aitc.topic IS NOT NULL
        AND aitc.topic != ''
      GROUP BY topic
      HAVING COUNT(DISTINCT student_id) >= ${minStudents}
      ORDER BY student_count DESC, question_count DESC
    `

    if (groupStruggles.length === 0) {
      return NextResponse.json({
        success: true,
        groupInterventions: [],
        message: "No group struggles detected"
      })
    }

    // For each group struggle, get sample questions
    const interventionsWithQuestions = await Promise.all(
      groupStruggles.map(async (struggle: any) => {
        const sampleQuestions = await sql`
          SELECT 
            message,
            s.full_name as student_name
          FROM ai_tutor_conversations aitc
          JOIN students s ON aitc.student_id = s.id
          WHERE 
            topic = ${struggle.topic}
            AND created_at >= NOW() - INTERVAL '${hours} hours'
          ORDER BY created_at DESC
          LIMIT 10
        `

        return {
          ...struggle,
          sampleQuestions: sampleQuestions.map((q: any) => ({
            question: q.message,
            student: q.student_name
          }))
        }
      })
    )

    // Generate AI recommendations for group interventions
    const systemPrompt = `You are an expert instructor planning group intervention sessions.

Your task: Design effective group review sessions based on widespread confusion.

Session planning requirements:
1. Optimal group size (break into smaller groups if needed)
2. Session structure with timestamps
3. Interactive activities
4. Practice problems
5. Assessment method

Provide recommendations in this JSON format:
{
  "interventions": [
    {
      "topic": "Topic name",
      "studentCount": number,
      "sessionType": "review|workshop|q&a|practice",
      "recommendedDuration": "X minutes",
      "groupSize": "optimal group size",
      "agenda": [
        {
          "time": "0-10 min",
          "activity": "Activity name",
          "description": "What to do"
        }
      ],
      "preparation": {
        "materialsNeeded": ["Material 1", "Material 2"],
        "instructorPrep": "What instructor should prepare"
      },
      "deliveryMethod": "in-person|online|hybrid",
      "followUp": "What to do after session",
      "expectedOutcome": "What students will gain"
    }
  ]
}`

    const topInterventions = interventionsWithQuestions.slice(0, 5)

    const { content } = await createForFeature(openai, "insights", {

      messages: [
        { role: "system", content: systemPrompt },
        { 
          role: "user", 
          content: `Plan group interventions for these widespread struggles:\n\n${JSON.stringify(topInterventions, null, 2)}` 
        }
      ],
      temperature: 0.5,
      max_tokens: 3500,
      response_format: { type: "json_object" }
    })

    const aiRecommendations = JSON.parse(content || "{}")

    return NextResponse.json({
      success: true,
      groupInterventions: interventionsWithQuestions,
      aiRecommendations: aiRecommendations.interventions || [],
      summary: {
        totalGroups: interventionsWithQuestions.length,
        totalStudentsAffected: interventionsWithQuestions.reduce((sum: number, g: any) => 
          sum + parseInt(g.student_count), 0
        ),
        mostUrgentTopic: interventionsWithQuestions[0]?.topic,
        timeRange: `Last ${hours} hours`
      }
    })

  } catch (error: any) {
    console.error("[Group Interventions Error]", error)
    return NextResponse.json(
      { 
        success: false, 
        error: "Failed to generate group interventions",
        groupInterventions: []
      },
      { status: 500 }
    )
  }
}

