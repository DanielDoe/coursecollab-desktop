import { type NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { sql } from "@/lib/db"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function GET(request: NextRequest) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    console.log("[v0] Fetching practice analytics...")

    const overallStats = await sql`
      SELECT 
        COUNT(*) as total_attempts,
        COUNT(DISTINCT student_id) as total_students,
        COALESCE(AVG(score_percentage), 0) as avg_score
      FROM practice_attempts
      WHERE completed_at IS NOT NULL
    `

    const totalQuestions = await sql`
      SELECT COUNT(*) as count
      FROM question_bank
    `

    const totalTopics = await sql`
      SELECT COUNT(DISTINCT topic) as count
      FROM question_bank
    `

    const availableTopics = await sql`
      SELECT COUNT(DISTINCT topic_name) as count
      FROM practice_topic_availability
      WHERE session = 'ALL' AND is_available = true
    `

    const availableQuestions = await sql`
      SELECT COUNT(qb.*) as count
      FROM question_bank qb
      WHERE EXISTS (
        SELECT 1 FROM practice_topic_availability pta
        WHERE pta.topic_name = qb.topic
        AND pta.session = 'ALL'
        AND pta.is_available = true
      )
    `

    console.log("[v0] Overall stats:", overallStats[0])
    console.log("[v0] Total questions:", totalQuestions[0])
    console.log("[v0] Total topics:", totalTopics[0])
    console.log("[v0] Available topics:", availableTopics[0])
    console.log("[v0] Available questions:", availableQuestions[0])

    const topicPerformance = await sql`
      SELECT 
        unnest(topics) as topic,
        COUNT(*) as attempts,
        COALESCE(AVG(score_percentage), 0) as avg_score,
        COALESCE(SUM(total_questions), 0) as total_questions
      FROM practice_attempts
      WHERE completed_at IS NOT NULL
      GROUP BY unnest(topics)
      ORDER BY attempts DESC
    `

    console.log("[v0] Topic performance:", topicPerformance)

    const recentActivity = await sql`
      SELECT 
        s.full_name as student_name,
        s.student_id,
        pa.topics,
        pa.score_percentage as score,
        pa.completed_at,
        pa.total_questions
      FROM practice_attempts pa
      JOIN students s ON pa.student_id = s.id
      WHERE pa.completed_at IS NOT NULL
      ORDER BY pa.completed_at DESC
      LIMIT 10
    `

    console.log("[v0] Recent activity:", recentActivity)

    const sessionBreakdown = await sql`
      SELECT 
        s.section as session,
        COUNT(*) as attempts,
        COALESCE(AVG(pa.score_percentage), 0) as avg_score,
        COUNT(DISTINCT pa.student_id) as students
      FROM practice_attempts pa
      JOIN students s ON pa.student_id = s.id
      WHERE pa.completed_at IS NOT NULL
      GROUP BY s.section
      ORDER BY s.section
    `

    console.log("[v0] Session breakdown:", sessionBreakdown)

    const timeDistribution = await sql`
      SELECT 
        EXTRACT(HOUR FROM completed_at) as hour,
        COUNT(*) as attempts
      FROM practice_attempts
      WHERE completed_at IS NOT NULL
      GROUP BY EXTRACT(HOUR FROM completed_at)
      ORDER BY hour
    `

    console.log("[v0] Time distribution:", timeDistribution)

    const response = {
      overview: {
        totalAttempts: Number(overallStats[0]?.total_attempts) || 0,
        totalStudents: Number(overallStats[0]?.total_students) || 0,
        avgScore: Number(overallStats[0]?.avg_score) || 0,
        totalQuestions: Number(totalQuestions[0]?.count) || 0,
        totalTopics: Number(totalTopics[0]?.count) || 0,
        availableTopics: Number(availableTopics[0]?.count) || 0,
        availableQuestions: Number(availableQuestions[0]?.count) || 0,
      },
      topicPerformance: topicPerformance.map((row) => ({
        topic: row.topic,
        attempts: Number(row.attempts) || 0,
        avgScore: Number(row.avg_score) || 0,
        totalQuestions: Number(row.total_questions) || 0,
      })),
      recentActivity: recentActivity.map((row) => ({
        student_name: row.student_name,
        student_id: row.student_id,
        topics: row.topics,
        score: Number(row.score) || 0,
        completed_at: row.completed_at,
        total_questions: Number(row.total_questions) || 0,
      })),
      sessionBreakdown: sessionBreakdown.map((row) => ({
        session: row.session,
        attempts: Number(row.attempts) || 0,
        avgScore: Number(row.avg_score) || 0,
        students: Number(row.students) || 0,
      })),
      timeDistribution: timeDistribution.map((row) => ({
        hour: Number(row.hour) || 0,
        attempts: Number(row.attempts) || 0,
      })),
    }

    console.log("[v0] Returning analytics response:", response)

    return NextResponse.json(response)
  } catch (error) {
    console.error("[v0] Error fetching practice analytics:", error)
    return NextResponse.json({
      overview: {
        totalAttempts: 0,
        totalStudents: 0,
        avgScore: 0,
        totalQuestions: 0,
        totalTopics: 0,
        availableTopics: 0,
        availableQuestions: 0,
      },
      topicPerformance: [],
      recentActivity: [],
      sessionBreakdown: [],
      timeDistribution: [],
    })
  }
}
