import { NextRequest, NextResponse } from "next/server"
import { getSQL } from "@/lib/db"
import { withLectureProgressTriggersDisabled } from "@/lib/lecture-progress-triggers"

const sql = getSQL()

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const lectureId = parseInt(id)
    const body = await request.json()
    const { student_id } = body

    if (!student_id) {
      return NextResponse.json(
        { error: "Student ID is required" },
        { status: 400 }
      )
    }

    // Get student database ID
    const studentResult = await sql`
      SELECT id FROM students WHERE student_id = ${student_id}
    `

    if (studentResult.length === 0) {
      return NextResponse.json(
        { error: "Student not found" },
        { status: 404 }
      )
    }

    const studentDbId = studentResult[0].id

    // Record the lecture view (insert only, allow multiple views per day)
    await sql`
      INSERT INTO lecture_views (lecture_id, student_id, viewed_at)
      VALUES (${lectureId}, ${studentDbId}, NOW())
      ON CONFLICT DO NOTHING
    `

    // Create or update initial progress record if it doesn't exist
    // This ensures the lecture shows as "in_progress" instead of "not_started"
    const progressCheck = await sql`
      SELECT id FROM lecture_student_progress
      WHERE lecture_id = ${lectureId} AND student_id = ${studentDbId}
    `

    if (progressCheck.length === 0) {
      await withLectureProgressTriggersDisabled(async () => {
        await sql`
          INSERT INTO lecture_student_progress (
            lecture_id,
            student_id,
            last_viewed_slide_order,
            completed_slides,
            progress_percentage,
            status,
            last_accessed
          )
          VALUES (
            ${lectureId},
            ${studentDbId},
            1,
            '[1]'::jsonb,
            1,
            'in_progress',
            NOW()
          )
          ON CONFLICT (student_id, lecture_id) DO NOTHING
        `
      })
      console.log(`[Lecture View] Created initial progress record for lecture ${lectureId}, student ${studentDbId}`)
    } else {
      await withLectureProgressTriggersDisabled(async () => {
        await sql`
          UPDATE lecture_student_progress
          SET
            last_accessed = NOW(),
            last_viewed_slide_order = GREATEST(COALESCE(last_viewed_slide_order, 0), 1),
            completed_slides = CASE
              WHEN completed_slides IS NULL
                OR completed_slides::text IN ('[]', 'null')
                OR jsonb_array_length(completed_slides::jsonb) = 0
              THEN '[1]'::jsonb
              ELSE completed_slides
            END,
            progress_percentage = GREATEST(
              COALESCE(progress_percentage, 0),
              CASE WHEN status = 'completed' THEN 100 ELSE 1 END
            ),
            status = CASE
              WHEN status = 'completed' THEN 'completed'
              ELSE 'in_progress'
            END
          WHERE lecture_id = ${lectureId} AND student_id = ${studentDbId}
        `
      })
    }

    // Update lecture engagement stats
    await sql`
      UPDATE lectures
      SET 
        total_views = COALESCE(total_views, 0) + 1,
        unique_viewers = (
          SELECT COUNT(DISTINCT student_id)
          FROM lecture_views
          WHERE lecture_id = ${lectureId}
        )
      WHERE id = ${lectureId}
    `

    // Sync points to trading center (background, non-blocking)
    try {
      const student = await sql`
        SELECT section FROM students WHERE id = ${studentDbId}
      `
      const session = student[0]?.section || "ALL"
      
      const { syncActivityPointsAfterAction } = await import("@/lib/trade-center-sync")
      await syncActivityPointsAfterAction(studentDbId, session, "lecture")
      console.log(`[Lecture View] Synced lecture reading points to Trade Center for student ${studentDbId}`)
    } catch (syncError) {
      console.error("[Lecture View] Trade Center sync failed (non-critical):", syncError)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[Lecture View Tracking] Error:", error)
    return NextResponse.json(
      { error: "Failed to track lecture view" },
      { status: 500 }
    )
  }
}

