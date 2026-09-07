import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const studentId = searchParams.get("studentId")

    if (studentId) {
      // Get specific student reputation
      const reputation = await sql`
        SELECT 
          sr.*,
          s.full_name,
          s.email
        FROM student_reputation sr
        LEFT JOIN students s ON sr.student_id = s.id
        WHERE sr.student_id = ${studentId}
      `

      if (reputation.length === 0) {
        return NextResponse.json({
          reputation: { student_id: studentId, points: 0, badges: [] },
        })
      }

      return NextResponse.json({ reputation: reputation[0] })
    } else {
      // Get leaderboard
      const leaderboard = await sql`
        SELECT 
          sr.*,
          s.full_name,
          s.email
        FROM student_reputation sr
        LEFT JOIN students s ON sr.student_id = s.id
        ORDER BY sr.points DESC
        LIMIT 50
      `

      return NextResponse.json({ leaderboard })
    }
  } catch (error) {
    console.error("Failed to fetch reputation:", error)
    return NextResponse.json({ error: "Failed to fetch reputation" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { studentId, points, badge } = body

    if (!studentId) {
      return NextResponse.json({ error: "Student ID is required" }, { status: 400 })
    }

    if (badge) {
      // Add badge
      await sql`
        INSERT INTO student_reputation (student_id, points, badges)
        VALUES (${studentId}, ${points || 0}, ARRAY[${badge}])
        ON CONFLICT (student_id) 
        DO UPDATE SET 
          points = student_reputation.points + ${points || 0},
          badges = array_append(student_reputation.badges, ${badge}),
          updated_at = CURRENT_TIMESTAMP
      `
    } else if (points) {
      // Add points only
      await sql`
        INSERT INTO student_reputation (student_id, points)
        VALUES (${studentId}, ${points})
        ON CONFLICT (student_id) 
        DO UPDATE SET 
          points = student_reputation.points + ${points},
          updated_at = CURRENT_TIMESTAMP
      `
    }

    const result = await sql`
      SELECT * FROM student_reputation WHERE student_id = ${studentId}
    `

    return NextResponse.json({ reputation: result[0] })
  } catch (error) {
    console.error("Failed to update reputation:", error)
    return NextResponse.json({ error: "Failed to update reputation" }, { status: 500 })
  }
}
