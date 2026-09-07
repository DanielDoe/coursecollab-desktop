import { type NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { sql } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const adminId = admin.adminId

    const [tutorStats, masteryStats, storedInsights, earlyWarnings] = await Promise.all([
      sql`
        SELECT
          COUNT(*)::int AS total_conversations,
          COUNT(DISTINCT student_id)::int AS unique_students,
          COUNT(DISTINCT topic)::int AS unique_topics
        FROM ai_tutor_conversations
        WHERE created_at >= NOW() - INTERVAL '14 days'
      `,
      sql`
        SELECT
          ROUND(AVG(mastery_percentage)::numeric, 1) AS avg_mastery,
          COUNT(DISTINCT student_id)::int AS students_tracked,
          COUNT(DISTINCT topic)::int AS topics_tracked
        FROM ai_tutor_topic_mastery
      `,
      sql`
        SELECT insight_type, data, created_at
        FROM ai_instructor_insights
        ORDER BY created_at DESC
        LIMIT 5
      `,
      sql`
        WITH topic_questions AS (
          SELECT student_id, topic, COUNT(*) AS question_count
          FROM ai_tutor_conversations
          WHERE created_at >= NOW() - INTERVAL '7 days'
            AND topic IS NOT NULL AND topic != ''
          GROUP BY student_id, topic
          HAVING COUNT(*) >= 5
        )
        SELECT COUNT(*)::int AS warning_count
        FROM topic_questions
      `,
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
    console.error("[admin/ai-insights-summary]", error)
    return NextResponse.json({ error: "Failed to load AI insights summary" }, { status: 500 })
  }
}
