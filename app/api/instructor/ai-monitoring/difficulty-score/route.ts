import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const days = parseInt(searchParams.get("days") || "14")

    // Calculate difficulty score for each topic based on:
    // 1. Number of questions asked (more = harder)
    // 2. Number of unique students asking (more = harder)
    // 3. Repeated questions by same student (more = harder)
    // 4. Response time needed (longer = harder)
    const topicDifficulty = await sql`
      WITH topic_stats AS (
        SELECT 
          topic,
          COUNT(*) as total_questions,
          COUNT(DISTINCT student_id) as unique_students,
          AVG(response_time) as avg_response_time,
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') as recent_questions,
          -- Calculate repeat question rate
          AVG(
            (SELECT COUNT(*) 
             FROM ai_tutor_conversations aitc2 
             WHERE aitc2.student_id = aitc.student_id 
               AND aitc2.topic = aitc.topic
               AND aitc2.created_at <= aitc.created_at
            )
          ) as avg_questions_per_student
        FROM ai_tutor_conversations aitc
        WHERE 
          created_at >= NOW() - make_interval(days => ${days})
          AND topic IS NOT NULL
          AND topic != ''
          AND topic != 'General'
        GROUP BY topic
      ),
      normalized_stats AS (
        SELECT 
          topic,
          total_questions,
          unique_students,
          avg_response_time,
          recent_questions,
          avg_questions_per_student,
          -- Normalize metrics to 0-100 scale
          (total_questions::float / NULLIF(MAX(total_questions) OVER (), 0)) * 100 as questions_score,
          (unique_students::float / NULLIF(MAX(unique_students) OVER (), 0)) * 100 as students_score,
          (avg_response_time::float / NULLIF(MAX(avg_response_time) OVER (), 0)) * 100 as time_score,
          (avg_questions_per_student::float / NULLIF(MAX(avg_questions_per_student) OVER (), 0)) * 100 as repeat_score
        FROM topic_stats
      )
      SELECT 
        topic,
        total_questions,
        unique_students,
        ROUND(avg_response_time::numeric / 1000, 2) as avg_response_seconds,
        recent_questions,
        ROUND(avg_questions_per_student::numeric, 2) as avg_questions_per_student,
        -- Weighted difficulty score
        ROUND(
          (
            (questions_score * 0.3) +
            (students_score * 0.3) +
            (time_score * 0.2) +
            (repeat_score * 0.2)
          )::numeric, 
          1
        ) as difficulty_score
      FROM normalized_stats
      WHERE total_questions >= 3
      ORDER BY difficulty_score DESC
    `

    // Categorize by difficulty
    const categorized = topicDifficulty.map((topic: any) => {
      const score = parseFloat(topic.difficulty_score)
      let category = "easy"
      let color = "green"
      
      if (score >= 75) {
        category = "very_hard"
        color = "red"
      } else if (score >= 60) {
        category = "hard"
        color = "orange"
      } else if (score >= 40) {
        category = "moderate"
        color = "yellow"
      } else if (score >= 20) {
        category = "medium"
        color = "blue"
      }

      return {
        ...topic,
        category,
        color,
        needsAttention: score >= 60
      }
    })

    // Get topic mastery data from ai_tutor_topic_mastery
    const masteryData = await sql`
      SELECT 
        topic,
        AVG(mastery_percentage) as avg_mastery,
        COUNT(DISTINCT student_id) as students_with_mastery
      FROM ai_tutor_topic_mastery
      GROUP BY topic
    `

    // Merge difficulty with mastery
    const enriched = categorized.map((topic: any) => {
      const mastery = masteryData.find((m: any) => m.topic === topic.topic)
      return {
        ...topic,
        avgMastery: mastery ? parseFloat(mastery.avg_mastery) : null,
        studentsWithMastery: mastery ? parseInt(mastery.students_with_mastery) : 0
      }
    })

    // Summary statistics
    const summary = {
      totalTopics: categorized.length,
      veryHard: categorized.filter((t: any) => t.category === "very_hard").length,
      hard: categorized.filter((t: any) => t.category === "hard").length,
      moderate: categorized.filter((t: any) => t.category === "moderate").length,
      medium: categorized.filter((t: any) => t.category === "medium").length,
      easy: categorized.filter((t: any) => t.category === "easy").length,
      needingAttention: categorized.filter((t: any) => t.needsAttention).length
    }

    return NextResponse.json({
      success: true,
      topicDifficulty: enriched,
      summary,
      timeRange: `Last ${days} days`
    })
  } catch (error) {
    console.error("[Instructor AI Monitoring - Difficulty Score Error]", error)
    return NextResponse.json(
      { 
        success: false, 
        error: "Failed to calculate difficulty scores",
        topicDifficulty: [],
        summary: {
          totalTopics: 0,
          veryHard: 0,
          hard: 0,
          moderate: 0,
          medium: 0,
          easy: 0,
          needingAttention: 0
        }
      },
      { status: 500 }
    )
  }
}

