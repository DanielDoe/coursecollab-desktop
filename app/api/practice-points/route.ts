import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

export const dynamic = "force-dynamic"
export const revalidate = 0

// GET - Fetch pending practice points
export async function GET(request: NextRequest) {
  try {
    const { requireClassroomPointsInstructor } = await import("@/lib/classroom-points-request-auth")
    const scope = await requireClassroomPointsInstructor(request)
    if (!scope.ok) return scope.response

    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status") || "pending"
    const limit = parseInt(searchParams.get("limit") || "100")

    let points

    // Ensure daily_challenge_submissions table exists
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS daily_challenge_submissions (
          id SERIAL PRIMARY KEY,
          student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
          code TEXT NOT NULL,
          challenge_id VARCHAR(100) NOT NULL,
          challenge_title TEXT NOT NULL,
          challenge_description TEXT NOT NULL,
          score DECIMAL(3,1),
          points_awarded DECIMAL(5,2),
          feedback TEXT,
          detailed_feedback TEXT,
          status VARCHAR(20) DEFAULT 'pending',
          practice_point_id INTEGER,
          submitted_at TIMESTAMP DEFAULT NOW()
        )
      `
    } catch (e) {
      // Table might already exist, that's fine
      console.log("[Practice Points API] daily_challenge_submissions table check:", e)
    }

    if (status === "pending") {
      points = await sql`
        SELECT 
          ppp.*,
          s.student_id as student_number,
          s.full_name as student_name,
          i.name as instructor_name,
          ps.problem as practice_problem,
          ps.code as solution_code,
          dcs.id as daily_challenge_submission_id
        FROM pending_practice_points ppp
        JOIN students s ON ppp.student_id = s.id
        JOIN instructors i ON ppp.awarded_by = i.id
        LEFT JOIN practice_submissions ps ON ps.practice_point_id = ppp.id
        LEFT JOIN daily_challenge_submissions dcs ON dcs.practice_point_id = ppp.id
        WHERE ppp.status = 'pending'
        ORDER BY ppp.created_at DESC
        LIMIT ${limit}
      `
      
      console.log(`[Practice Points API] ✅ Found ${points.length} pending practice points`)
      if (points.length > 0) {
        console.log(`[Practice Points API] 📋 Sample pending point:`, {
          id: points[0].id,
          student_id: points[0].student_id,
          student_name: points[0].student_name,
          student_number: points[0].student_number,
          points: points[0].points,
          reason: points[0].reason?.substring(0, 100),
          status: points[0].status,
          created_at: points[0].created_at,
          session: points[0].session
        })
      } else {
        console.log(`[Practice Points API] ⚠️ No pending practice points found. Checking if table exists and has any data...`);
        // Debug query to see if table exists and has any data
        try {
          const allPending = await sql`
            SELECT COUNT(*) as count, status
            FROM pending_practice_points
            GROUP BY status
          `;
          console.log(`[Practice Points API] 🔍 Debug - All practice points by status:`, allPending);
        } catch (e) {
          console.error(`[Practice Points API] ❌ Error checking table:`, e);
        }
      }
    } else {
      points = await sql`
        SELECT 
          ppp.*,
          s.student_id as student_number,
          s.full_name as student_name,
          i.name as instructor_name,
          ps.problem as practice_problem,
          ps.code as solution_code
        FROM pending_practice_points ppp
        JOIN students s ON ppp.student_id = s.id
        JOIN instructors i ON ppp.awarded_by = i.id
        LEFT JOIN practice_submissions ps ON ps.practice_point_id = ppp.id
        WHERE ppp.status = ${status}
        ORDER BY ppp.awarded_at DESC NULLS LAST, ppp.created_at DESC
        LIMIT ${limit}
      `
    }

    console.log(`[Practice Points API] Found ${points.length} points with status=${status}`)

    return NextResponse.json({
      points,
      count: points.length
    })

  } catch (error) {
    console.error("Error fetching practice points:", error)
    return NextResponse.json(
      { error: "Failed to fetch practice points" },
      { status: 500 }
    )
  }
}

