import { type NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { sql } from "@/lib/db"

export const dynamic = "force-dynamic"

const EMPTY_STATS = {
  totalQuestions: 0,
  activeStudents: 0,
  averageResponseTime: 0,
  satisfactionScore: 0,
  strugglingStudents: 0,
  topTopics: [] as Array<{ topic: string; questions: number; struggles: number }>,
}

async function safeQuery<T>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn()
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    if (!message.includes("does not exist")) {
      console.error(`[Admin AI Tutor Stats] ${label}:`, error)
    }
    return fallback
  }
}

export async function GET(_request: NextRequest) {
  const admin = await requireAdminId(_request)
  if (!admin.ok) return admin.response

  try {
    const totalQuestions = await safeQuery(
      "totalQuestions",
      async () => {
        const rows = await sql`SELECT COUNT(*)::int as count FROM ai_tutor_conversations`
        return Number(rows[0]?.count ?? 0)
      },
      0,
    )

    const activeStudents = await safeQuery(
      "activeStudents",
      async () => {
        const rows = await sql`
          SELECT COUNT(DISTINCT student_id)::int as count
          FROM ai_tutor_conversations
          WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
        `
        return Number(rows[0]?.count ?? 0)
      },
      0,
    )

    const averageResponseTime = await safeQuery(
      "averageResponseTime",
      async () => {
        const rows = await sql`
          SELECT COALESCE(AVG(response_time), 0)::float as avg_time
          FROM ai_tutor_conversations
          WHERE response_time IS NOT NULL
        `
        return Math.round(Number(rows[0]?.avg_time ?? 0))
      },
      0,
    )

    const satisfactionScore = await safeQuery(
      "satisfactionScore",
      async () => {
        const rows = await sql`
          SELECT COALESCE(AVG(satisfaction_score), 0)::float as avg_score
          FROM ai_tutor_conversations
          WHERE satisfaction_score IS NOT NULL
        `
        return Math.round(Number(rows[0]?.avg_score ?? 0) * 10) / 10
      },
      0,
    )

    const strugglingStudents = await safeQuery(
      "strugglingStudents",
      async () => {
        const rows = await sql`
          SELECT COUNT(*)::int as count FROM (
            SELECT student_id
            FROM ai_tutor_conversations
            WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
            GROUP BY student_id
            HAVING COUNT(*) >= 3
               OR AVG(COALESCE(satisfaction_score, 5)) <= 4
          ) struggling
        `
        return Number(rows[0]?.count ?? 0)
      },
      0,
    )

    const topTopics = await safeQuery(
      "topTopics",
      async () => {
        const rows = await sql`
          SELECT
            topic,
            COUNT(*)::int as questions,
            COUNT(
              CASE
                WHEN satisfaction_score IS NOT NULL AND satisfaction_score < 3 THEN 1
              END
            )::int as struggles
          FROM ai_tutor_conversations
          WHERE topic IS NOT NULL AND TRIM(topic) <> ''
          GROUP BY topic
          ORDER BY questions DESC
          LIMIT 5
        `
        return rows.map((topic) => ({
          topic: String(topic.topic),
          questions: Number(topic.questions),
          struggles: Number(topic.struggles),
        }))
      },
      [],
    )

    return NextResponse.json({
      stats: {
        totalQuestions,
        activeStudents,
        averageResponseTime,
        satisfactionScore,
        strugglingStudents,
        topTopics,
      },
    })
  } catch (error) {
    console.error("[Admin AI Tutor Stats] Failed:", error)
    return NextResponse.json({ stats: EMPTY_STATS })
  }
}
