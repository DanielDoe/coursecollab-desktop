import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function GET(request: NextRequest) {
  try {
    const instructorId = request.nextUrl.searchParams.get("instructorId")
    
    if (!instructorId) {
      return NextResponse.json({ error: "Instructor ID required" }, { status: 400 })
    }

    const leaderboard = await sql`
      SELECT 
        s.username,
        s.email,
        COUNT(pa.id) as total_attempts,
        AVG(pa.score) as average_score,
        SUM(CASE WHEN pa.score >= 80 THEN 1 ELSE 0 END) as high_scores,
        MAX(pa.completed_at) as last_activity
      FROM students s
      LEFT JOIN practice_attempts pa ON s.id = pa.student_id
      WHERE pa.created_at >= NOW() - INTERVAL '30 days'
      GROUP BY s.id, s.username, s.email
      HAVING COUNT(pa.id) > 0
      ORDER BY average_score DESC, total_attempts DESC
      LIMIT 50
    `

    return NextResponse.json({ leaderboard })
  } catch (error) {
    console.error("Error fetching leaderboard:", error)
    return NextResponse.json({ error: "Failed to fetch leaderboard" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const instructorId = request.nextUrl.searchParams.get("instructorId")
    const body = await request.json()
    
    if (!instructorId) {
      return NextResponse.json({ error: "Instructor ID required" }, { status: 400 })
    }

    const { reset_type } = body // "daily", "weekly", "monthly"

    // Reset leaderboard based on type
    await sql`
      DELETE FROM practice_attempts 
      WHERE created_at < CASE 
        WHEN ${reset_type} = 'daily' THEN NOW() - INTERVAL '1 day'
        WHEN ${reset_type} = 'weekly' THEN NOW() - INTERVAL '1 week'
        WHEN ${reset_type} = 'monthly' THEN NOW() - INTERVAL '1 month'
        ELSE NOW() - INTERVAL '1 week'
      END
    `

    return NextResponse.json({ message: "Leaderboard reset successfully" })
  } catch (error) {
    console.error("Error resetting leaderboard:", error)
    return NextResponse.json({ error: "Failed to reset leaderboard" }, { status: 500 })
  }
}

