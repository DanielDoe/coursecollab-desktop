import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

export const dynamic = "force-dynamic"

async function safeQuery<T>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn()
  } catch (error) {
    console.warn(`[instructor/ai-insights/summary] ${label}:`, error)
    return fallback
  }
}

export async function GET(request: NextRequest) {
  try {
    const instructorId =
      new URL(request.url).searchParams.get("instructorId") ?? request.headers.get("x-instructor-id")
    if (!instructorId) {
      return NextResponse.json({ error: "Instructor ID required" }, { status: 400 })
    }

    const [tutorStats, masteryStats, storedInsights, earlyWarnings] = await Promise.all([
      safeQuery("tutor", () => sql`
        SELECT
          COUNT(*)::int AS total_conversations,
          COUNT(DISTINCT student_id)::int AS unique_students,
          COUNT(DISTINCT topic)::int AS unique_topics
        FROM ai_tutor_conversations
        WHERE created_at >= NOW() - INTERVAL '14 days'
      `, [{ total_conversations: 0, unique_students: 0, unique_topics: 0 }]),
      safeQuery("mastery", () => sql`
        SELECT
          ROUND(AVG(mastery_percentage)::numeric, 1) AS avg_mastery,
          COUNT(DISTINCT student_id)::int AS students_tracked,
          COUNT(DISTINCT topic)::int AS topics_tracked
        FROM ai_tutor_topic_mastery
      `, [{ avg_mastery: 0, students_tracked: 0, topics_tracked: 0 }]),
      safeQuery("insights", () => sql`
        SELECT insight_type, data, created_at
        FROM ai_instructor_insights
        ORDER BY created_at DESC
        LIMIT 5
      `, []),
      safeQuery("warnings", () => sql`
        WITH topic_questions AS (
          SELECT student_id, topic, COUNT(*) AS question_count
          FROM ai_tutor_conversations
          WHERE created_at >= NOW() - INTERVAL '7 days'
            AND topic IS NOT NULL AND topic != ''
          GROUP BY student_id, topic
          HAVING COUNT(*) >= 5
        )
        SELECT COUNT(*)::int AS warning_count FROM topic_questions
      `, [{ warning_count: 0 }]),
    ])

    const tutor = tutorStats[0] ?? {}
    const mastery = masteryStats[0] ?? {}
    const warnings = earlyWarnings[0] ?? {}

    return NextResponse.json({
      tutor: {
        conversations14d: Number(tutor.total_conversations ?? 0),
        uniqueStudents14d: Number(tutor.unique_students ?? 0),
        uniqueTopics14d: Number(tutor.unique_topics ?? 0),
      },
      mastery: {
        avgMastery: parseFloat(String(mastery.avg_mastery ?? 0)) || 0,
        studentsTracked: Number(mastery.students_tracked ?? 0),
        topicsTracked: Number(mastery.topics_tracked ?? 0),
      },
      earlyWarningCount: Number(warnings.warning_count ?? 0),
      recentInsights: storedInsights.map((row: Record<string, unknown>) => ({
        type: row.insight_type,
        createdAt: row.created_at,
        preview:
          typeof row.data === "object" && row.data !== null
            ? JSON.stringify(row.data).slice(0, 200)
            : String(row.data ?? "").slice(0, 200),
      })),
      generatedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error("[instructor/ai-insights/summary]", error)
    return NextResponse.json({ error: "Failed to load AI insights summary" }, { status: 500 })
  }
}
