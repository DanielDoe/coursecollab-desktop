import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import { instructorCanAccessAnnouncement } from "@/lib/announcement-request-auth"
import { requireBoundStudentCaller } from "@/lib/student-api-auth"

/**
 * POST /api/announcements/[id]/view
 * Mark an announcement as viewed by a student
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { studentId } = body

    const auth = await requireBoundStudentCaller(
      request,
      studentId != null ? String(studentId) : null,
    )
    if (!auth.ok) return auth.response

    // Check if announcement exists
    const announcement = await sql`
      SELECT id FROM announcements WHERE id = ${id}
    `

    if (announcement.length === 0) {
      return NextResponse.json({ error: "Announcement not found" }, { status: 404 })
    }

    const existingView = await sql`
      SELECT 1 FROM announcement_views
      WHERE announcement_id = ${id} AND student_id = ${auth.studentDbId}
      LIMIT 1
    `

    // Insert or update view record (upsert)
    await sql`
      INSERT INTO announcement_views (announcement_id, student_id, viewed_at)
      VALUES (${id}, ${auth.studentDbId}, CURRENT_TIMESTAMP)
      ON CONFLICT (announcement_id, student_id) 
      DO UPDATE SET viewed_at = CURRENT_TIMESTAMP
    `

    const viewCountResult = await sql`
      SELECT COUNT(*)::int AS total FROM announcement_views WHERE announcement_id = ${id}
    `

    return NextResponse.json({ 
      message: "View recorded",
      viewedAt: new Date().toISOString(),
      isNewView: existingView.length === 0,
      totalViews: Number(viewCountResult[0]?.total ?? 0),
    })
  } catch (error) {
    console.error("[Announcements] View error:", error)
    return NextResponse.json({ error: "Failed to record view" }, { status: 500 })
  }
}

/**
 * GET /api/announcements/[id]/view
 * Get view statistics for an announcement (instructor only)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response

    const announcement = await sql`
      SELECT author_id, course_id FROM announcements WHERE id = ${id}
    `

    if (announcement.length === 0) {
      return NextResponse.json({ error: "Announcement not found" }, { status: 404 })
    }

    const allowed = await instructorCanAccessAnnouncement(scope.instructorId, announcement[0])
    if (!allowed) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    // Get view statistics
    const viewStats = await sql`
      SELECT 
        COUNT(*) as total_views,
        ARRAY_AGG(s.full_name ORDER BY av.viewed_at DESC) as viewer_names,
        ARRAY_AGG(av.viewed_at ORDER BY av.viewed_at DESC) as view_times
      FROM announcement_views av
      JOIN students s ON av.student_id = s.id
      WHERE av.announcement_id = ${id}
    `

    const stats = viewStats[0]

    return NextResponse.json({ 
      totalViews: Number(stats?.total_views || 0),
      viewers: stats?.viewer_names || [],
      viewTimes: stats?.view_times || []
    })
  } catch (error) {
    console.error("[Announcements] Get views error:", error)
    return NextResponse.json({ error: "Failed to fetch view statistics" }, { status: 500 })
  }
}

