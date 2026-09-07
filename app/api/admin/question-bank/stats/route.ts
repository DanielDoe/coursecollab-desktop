import { type NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { sql } from "@/lib/db"

export async function GET(request: NextRequest) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    // Fetch question bank statistics
    const [
      totalQuestions,
      difficultyStats,
      topicStats,
      typeStats,
      mostUsedQuestions,
      recentlyAddedQuestions
    ] = await Promise.all([
      // Total questions count
      sql`SELECT COUNT(*) as total FROM questions WHERE is_archived = false`,
      
      // Questions by difficulty
      sql`
        SELECT difficulty, COUNT(*) as count
        FROM questions
        WHERE is_archived = false
        GROUP BY difficulty
        ORDER BY difficulty
      `,
      
      // Questions by topic
      sql`
        SELECT topic, COUNT(*) as count
        FROM questions
        WHERE is_archived = false
        GROUP BY topic
        ORDER BY count DESC
      `,
      
      // Questions by type
      sql`
        SELECT question_type, COUNT(*) as count
        FROM questions
        WHERE is_archived = false
        GROUP BY question_type
        ORDER BY count DESC
      `,
      
      // Most used questions
      sql`
        SELECT q.*, COUNT(qa.id) as usage_count
        FROM questions q
        LEFT JOIN quiz_questions qq ON q.id = qq.question_id
        LEFT JOIN quiz_attempts qa ON qq.quiz_id = qa.quiz_id
        WHERE q.is_archived = false
        GROUP BY q.id
        ORDER BY usage_count DESC
        LIMIT 5
      `,
      
      // Recently added questions
      sql`
        SELECT *
        FROM questions
        WHERE is_archived = false
        ORDER BY created_at DESC
        LIMIT 5
      `
    ])

    // Format statistics
    const stats = {
      total_questions: Number(totalQuestions[0]?.total || 0),
      by_difficulty: difficultyStats.reduce((acc: Record<string, number>, row: any) => {
        acc[row.difficulty] = Number(row.count)
        return acc
      }, {}),
      by_topic: topicStats.reduce((acc: Record<string, number>, row: any) => {
        acc[row.topic] = Number(row.count)
        return acc
      }, {}),
      by_type: typeStats.reduce((acc: Record<string, number>, row: any) => {
        acc[row.question_type] = Number(row.count)
        return acc
      }, {}),
      most_used: mostUsedQuestions.map((q: any) => ({
        id: q.id,
        question_text: q.question_text,
        question_type: q.question_type,
        difficulty: q.difficulty,
        topic: q.topic,
        usage_count: Number(q.usage_count || 0),
      })),
      recently_added: recentlyAddedQuestions.map((q: any) => ({
        id: q.id,
        question_text: q.question_text,
        question_type: q.question_type,
        difficulty: q.difficulty,
        topic: q.topic,
        created_at: q.created_at,
      })),
    }

    return NextResponse.json({ stats })
  } catch (error) {
    console.error("Failed to fetch question bank stats:", error)
    return NextResponse.json({ error: "Failed to fetch question bank stats" }, { status: 500 })
  }
}