import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

export const dynamic = "force-dynamic"

// Approve individual or all pending practice points
export async function POST(request: NextRequest) {
  try {
    const { requireClassroomPointsInstructor } = await import("@/lib/classroom-points-request-auth")
    const scope = await requireClassroomPointsInstructor(request)
    if (!scope.ok) return scope.response

    const { id, approveAll } = await request.json()

    if (approveAll) {
      // Approve all pending practice points
      const result = await sql`
        UPDATE pending_practice_points
        SET status = 'approved', awarded_at = COALESCE(awarded_at, NOW())
        WHERE status = 'pending'
        RETURNING *
      `

      // Update corresponding practice_submissions to approved
      if (result.length > 0) {
        try {
          const pointIds = result.map((r: any) => r.id)
          console.log("[Approve All Practice] Approving", result.length, "points, updating practice submissions")
          
          await sql`
            UPDATE practice_submissions
            SET status = 'approved'
            WHERE practice_point_id = ANY(${pointIds})
              AND status = 'pending'
          `

          // Add points to student_activity_points
          for (const point of result) {
            try {
              // Get current week start date
              const weekResult = await sql`
                SELECT DATE_TRUNC('week', CURRENT_DATE)::date as week_start
              `
              const weekStartDate = weekResult[0]?.week_start || new Date().toISOString().split('T')[0]

              // Get or create student activity points entry
              // Ensure practice_points is treated as DECIMAL/NUMERIC
              await sql`
                INSERT INTO student_activity_points (
                  student_id, session, practice_points, week_start_date
                )
                VALUES (
                  ${point.student_id}, ${point.session}, ${parseFloat(point.points.toString())}, ${weekStartDate}::date
                )
                ON CONFLICT (student_id, session, week_start_date)
                DO UPDATE SET
                  practice_points = student_activity_points.practice_points + ${parseFloat(point.points.toString())},
                  updated_at = NOW()
              `
              console.log("[Approve All Practice] Added", point.points, "practice points to student", point.student_id)
            } catch (error) {
              console.error("[Approve All Practice] Error updating activity points:", error)
              // Continue with other points even if one fails
            }
          }
        } catch (error) {
          console.log("[Approve All Practice] Practice submission update:", error)
          // Non-critical error, continue
        }
      }

      return NextResponse.json({
        success: true,
        message: `${result.length} practice points approved`,
        count: result.length,
      })
    } else {
      // Approve single point
      if (!id) {
        return NextResponse.json(
          { error: "Point ID is required" },
          { status: 400 }
        )
      }

      const result = await sql`
        UPDATE pending_practice_points
        SET status = 'approved', awarded_at = COALESCE(awarded_at, NOW())
        WHERE id = ${id} AND status = 'pending'
        RETURNING *
      `

      if (result.length === 0) {
        return NextResponse.json(
          { error: "Point not found or already approved" },
          { status: 404 }
        )
      }

      const approvedPoint = result[0]
      console.log("[Approve Practice] Approved point:", {
        id: approvedPoint.id,
        student_id: approvedPoint.student_id,
        points: approvedPoint.points,
      })

      // Update corresponding practice_submissions to approved
      try {
        await sql`
          UPDATE practice_submissions
          SET status = 'approved'
          WHERE practice_point_id = ${approvedPoint.id}
            AND status = 'pending'
        `

        // Add points to student_activity_points
        try {
          // Get current week start date
          const weekResult = await sql`
            SELECT DATE_TRUNC('week', CURRENT_DATE)::date as week_start
          `
          const weekStartDate = weekResult[0]?.week_start || new Date().toISOString().split('T')[0]

          // Get or create student activity points entry
          // Ensure practice_points is treated as DECIMAL/NUMERIC
          await sql`
            INSERT INTO student_activity_points (
              student_id, session, practice_points, week_start_date
            )
            VALUES (
              ${approvedPoint.student_id}, ${approvedPoint.session}, ${parseFloat(approvedPoint.points.toString())}, ${weekStartDate}::date
            )
            ON CONFLICT (student_id, session, week_start_date)
            DO UPDATE SET
              practice_points = student_activity_points.practice_points + ${parseFloat(approvedPoint.points.toString())},
              updated_at = NOW()
          `
          console.log("[Approve Practice] Added", approvedPoint.points, "practice points to student", approvedPoint.student_id)
        } catch (error) {
          console.error("[Approve Practice] Error updating activity points:", error)
          // Return success even if activity points update fails (can be fixed manually)
        }
      } catch (error) {
        console.log("[Approve Practice] Practice submission update:", error)
        // Non-critical error, continue
      }

      return NextResponse.json({
        success: true,
        message: "Practice point approved",
        point: result[0],
      })
    }
  } catch (error) {
    console.error("[Approve Practice Points] Error:", error)
    return NextResponse.json(
      { error: "Failed to approve practice points" },
      { status: 500 }
    )
  }
}

// Reject individual practice point
export async function DELETE(request: NextRequest) {
  try {
    const { requireClassroomPointsInstructor } = await import("@/lib/classroom-points-request-auth")
    const scope = await requireClassroomPointsInstructor(request)
    if (!scope.ok) return scope.response

    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json(
        { error: "Point ID is required" },
        { status: 400 }
      )
    }

    const result = await sql`
      UPDATE pending_practice_points
      SET status = 'rejected'
      WHERE id = ${id} AND status = 'pending'
      RETURNING *
    `

    if (result.length === 0) {
      return NextResponse.json(
        { error: "Point not found or already processed" },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: "Practice point rejected",
      point: result[0],
    })
  } catch (error) {
    console.error("[Reject Practice Points] Error:", error)
    return NextResponse.json(
      { error: "Failed to reject practice point" },
      { status: 500 }
    )
  }
}


