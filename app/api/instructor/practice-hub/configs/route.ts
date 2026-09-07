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

    const configs = await sql`
      SELECT 
        daily_limit,
        difficulty_distribution,
        topic_weights,
        leaderboard_reset_schedule,
        is_active
      FROM practice_configs 
      WHERE instructor_id = ${instructorId}
      ORDER BY created_at DESC
      LIMIT 1
    `

    return NextResponse.json({ 
      configs: configs[0] || {
        daily_limit: 10,
        difficulty_distribution: { easy: 0.3, medium: 0.5, hard: 0.2 },
        topic_weights: {},
        leaderboard_reset_schedule: "weekly",
        is_active: true
      }
    })
  } catch (error) {
    console.error("Error fetching practice configs:", error)
    return NextResponse.json({ error: "Failed to fetch configs" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const instructorId = request.nextUrl.searchParams.get("instructorId")
    const body = await request.json()
    
    if (!instructorId) {
      return NextResponse.json({ error: "Instructor ID required" }, { status: 400 })
    }

    const {
      daily_limit,
      difficulty_distribution,
      topic_weights,
      leaderboard_reset_schedule,
      is_active
    } = body

    const config = await sql`
      INSERT INTO practice_configs (
        instructor_id, daily_limit, difficulty_distribution, 
        topic_weights, leaderboard_reset_schedule, is_active
      ) VALUES (
        ${instructorId}, ${daily_limit}, ${JSON.stringify(difficulty_distribution)},
        ${JSON.stringify(topic_weights)}, ${leaderboard_reset_schedule}, ${is_active}
      ) RETURNING *
    `

    return NextResponse.json({ config: config[0] })
  } catch (error) {
    console.error("Error updating practice configs:", error)
    return NextResponse.json({ error: "Failed to update configs" }, { status: 500 })
  }
}

