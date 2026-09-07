import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getPracticeHubPolicyForCourse } from "@/lib/practice-hub-policy-settings.server"
import { requireStudentPracticeCaller } from "@/lib/require-student-practice-auth"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const studentId = searchParams.get("studentId")

    const auth = await requireStudentPracticeCaller(request, studentId)
    if (!auth.ok) return auth.response

    const studentRows = await sql`SELECT course_id FROM students WHERE id = ${auth.studentDbId} LIMIT 1`
    const courseId = studentRows[0]?.course_id != null ? Number(studentRows[0].course_id) : null
    const hubPolicy = await getPracticeHubPolicyForCourse(courseId)
    const xpPerLevel = hubPolicy.xp_per_level

    // Get topic-wise accuracy for radar chart
    const topicAccuracy = await sql`
      SELECT 
        pa.topics as topic,
        COUNT(*) as attempts,
        AVG(pa.score_percentage) as avg_score,
        SUM(CASE WHEN pa.score_percentage >= 70 THEN 1 ELSE 0 END)::float / COUNT(*) * 100 as accuracy
      FROM practice_attempts pa
      WHERE pa.student_id = ${auth.studentDbId}
        AND pa.completed_at IS NOT NULL
      GROUP BY pa.topics
      ORDER BY accuracy DESC
      LIMIT 6
    `

    // Get last 7 sessions trend
    const sessionTrend = await sql`
      SELECT 
        DATE(completed_at) as date,
        AVG(score_percentage) as avg_score
      FROM practice_attempts
      WHERE student_id = ${auth.studentDbId}
        AND completed_at IS NOT NULL
        AND completed_at >= NOW() - INTERVAL '7 days'
      GROUP BY DATE(completed_at)
      ORDER BY date ASC
    `

    // Get XP and level info
    const xpInfo = await sql`
      SELECT 
        total_practice_points as current_xp,
        FLOOR(total_practice_points / ${xpPerLevel}) as current_level,
        (total_practice_points % ${xpPerLevel}) as level_progress,
        ${xpPerLevel} as xp_to_next_level
      FROM practice_leaderboard
      WHERE student_id = ${auth.studentDbId}
    `

    // Get weekly improvement
    const weeklyImprovement = await sql`
      WITH this_week AS (
        SELECT AVG(score_percentage) as avg_score
        FROM practice_attempts
        WHERE student_id = ${auth.studentDbId}
          AND completed_at >= NOW() - INTERVAL '7 days'
          AND completed_at IS NOT NULL
      ),
      last_week AS (
        SELECT AVG(score_percentage) as avg_score
        FROM practice_attempts
        WHERE student_id = ${auth.studentDbId}
          AND completed_at >= NOW() - INTERVAL '14 days'
          AND completed_at < NOW() - INTERVAL '7 days'
          AND completed_at IS NOT NULL
      )
      SELECT 
        COALESCE(this_week.avg_score, 0) as this_week_avg,
        COALESCE(last_week.avg_score, 0) as last_week_avg,
        COALESCE(this_week.avg_score - last_week.avg_score, 0) as improvement
      FROM this_week, last_week
    `

    // Get activity heatmap (last 28 days)
    const activityHeatmap = await sql`
      SELECT 
        DATE(completed_at) as date,
        COUNT(*) as sessions
      FROM practice_attempts
      WHERE student_id = ${auth.studentDbId}
        AND completed_at >= NOW() - INTERVAL '28 days'
        AND completed_at IS NOT NULL
      GROUP BY DATE(completed_at)
      ORDER BY date ASC
    `

    return NextResponse.json({
      topicAccuracy: topicAccuracy || [],
      sessionTrend: sessionTrend || [],
      xpInfo: xpInfo[0] || { current_xp: 0, current_level: 0, level_progress: 0, xp_to_next_level: 500 },
      weeklyImprovement: weeklyImprovement[0] || { this_week_avg: 0, last_week_avg: 0, improvement: 0 },
      activityHeatmap: activityHeatmap || [],
    })
  } catch (error) {
    console.error("[v0] Failed to fetch practice analytics:", error)
    return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 })
  }
}
