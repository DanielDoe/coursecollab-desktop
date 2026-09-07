import { type NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { sql } from "@/lib/db"

export async function GET(request: NextRequest) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    // Fetch practice leaderboard
    const leaderboard = await sql`
      SELECT 
        s.id,
        s.full_name as student_name,
        s.student_number,
        SUM(pa.score) as total_score,
        COUNT(pa.id) as total_attempts,
        AVG(pa.score) as average_score,
        COUNT(CASE WHEN pa.created_at > NOW() - INTERVAL '7 days' THEN 1 END) as streak,
        ARRAY_AGG(DISTINCT CASE WHEN pa.score >= 90 THEN 'High Scorer' END) FILTER (WHERE pa.score >= 90) as badges,
        MAX(pa.created_at) as last_activity
      FROM students s
      LEFT JOIN practice_attempts pa ON s.id = pa.student_id
      WHERE pa.created_at > NOW() - INTERVAL '30 days'
      GROUP BY s.id, s.full_name, s.student_number
      HAVING COUNT(pa.id) > 0
      ORDER BY total_score DESC, average_score DESC
      LIMIT 50
    `

    // Add rank to each entry
    const rankedLeaderboard = leaderboard.map((entry: any, index: number) => ({
      id: entry.id,
      student_name: entry.student_name,
      student_number: entry.student_number,
      total_score: Number(entry.total_score || 0),
      total_attempts: Number(entry.total_attempts || 0),
      average_score: Number(entry.average_score || 0),
      rank: index + 1,
      streak: Number(entry.streak || 0),
      badges: entry.badges.filter((badge: string) => badge !== null),
      last_activity: entry.last_activity,
    }))

    return NextResponse.json({ leaderboard: rankedLeaderboard })
  } catch (error) {
    console.error("Failed to fetch practice leaderboard:", error)
    return NextResponse.json({ error: "Failed to fetch practice leaderboard" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const adminId = sessionStorage.getItem("adminId")
    if (!adminId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { action } = body

    if (action === "reset") {
      // Reset all practice scores and attempts
      await sql`
        UPDATE practice_attempts 
        SET score = 0, completed_at = NULL
        WHERE created_at > NOW() - INTERVAL '30 days'
      `

      return NextResponse.json({ 
        message: "Leaderboard reset successfully" 
      })
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (error) {
    console.error("Failed to reset leaderboard:", error)
    return NextResponse.json({ error: "Failed to reset leaderboard" }, { status: 500 })
  }
}

