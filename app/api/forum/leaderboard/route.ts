import { NextResponse } from "next/server"
import { sql } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get("sessionId")

    // Get weekly leaderboard (top contributors this week)
    const weeklyLeaderboard = sessionId
      ? await sql`
          SELECT 
            sr.student_id,
            s.full_name,
            sr.points,
            sr.badges,
            COUNT(DISTINCT ft.id) as threads_count,
            COUNT(DISTINCT fr.id) as replies_count,
            COUNT(DISTINCT freq.id) as feature_requests_count,
            COUNT(DISTINCT br.id) as bug_reports_count
          FROM student_reputation sr
          LEFT JOIN students s ON sr.student_id = s.id
          LEFT JOIN forum_threads ft ON ft.student_id = s.id AND ft.created_at > NOW() - INTERVAL '7 days'
          LEFT JOIN forum_replies fr ON fr.student_id = s.id AND fr.created_at > NOW() - INTERVAL '7 days'
          LEFT JOIN feature_requests freq ON freq.student_id = s.id AND freq.created_at > NOW() - INTERVAL '7 days'
          LEFT JOIN bug_reports br ON br.student_id = s.id AND br.created_at > NOW() - INTERVAL '7 days'
          WHERE s.session_id = ${sessionId}
          GROUP BY sr.student_id, s.full_name, sr.points, sr.badges
          ORDER BY sr.points DESC
          LIMIT 10
        `
      : await sql`
          SELECT 
            sr.student_id,
            s.full_name,
            sr.points,
            sr.badges,
            COUNT(DISTINCT ft.id) as threads_count,
            COUNT(DISTINCT fr.id) as replies_count,
            COUNT(DISTINCT freq.id) as feature_requests_count,
            COUNT(DISTINCT br.id) as bug_reports_count
          FROM student_reputation sr
          LEFT JOIN students s ON sr.student_id = s.id
          LEFT JOIN forum_threads ft ON ft.student_id = s.id AND ft.created_at > NOW() - INTERVAL '7 days'
          LEFT JOIN forum_replies fr ON fr.student_id = s.id AND fr.created_at > NOW() - INTERVAL '7 days'
          LEFT JOIN feature_requests freq ON freq.student_id = s.id AND freq.created_at > NOW() - INTERVAL '7 days'
          LEFT JOIN bug_reports br ON br.student_id = s.id AND br.created_at > NOW() - INTERVAL '7 days'
          GROUP BY sr.student_id, s.full_name, sr.points, sr.badges
          ORDER BY sr.points DESC
          LIMIT 10
        `

    // Get all-time top contributors
    const allTimeLeaderboard = sessionId
      ? await sql`
          SELECT 
            sr.student_id,
            s.full_name,
            sr.points,
            sr.badges
          FROM student_reputation sr
          LEFT JOIN students s ON sr.student_id = s.id
          WHERE s.session_id = ${sessionId}
          ORDER BY sr.points DESC
          LIMIT 20
        `
      : await sql`
          SELECT 
            sr.student_id,
            s.full_name,
            sr.points,
            sr.badges
          FROM student_reputation sr
          LEFT JOIN students s ON sr.student_id = s.id
          ORDER BY sr.points DESC
          LIMIT 20
        `

    return NextResponse.json({
      weekly: weeklyLeaderboard,
      allTime: allTimeLeaderboard,
    })
  } catch (error) {
    console.error("Failed to fetch leaderboard:", error)
    return NextResponse.json({ error: "Failed to fetch leaderboard" }, { status: 500 })
  }
}
