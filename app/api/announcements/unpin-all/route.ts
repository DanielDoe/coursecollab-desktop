import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import { resolveInstructorSessionCodeForScope } from "@/lib/instructor-session-scope"
import { facultyAnnouncementsWhereClause } from "@/lib/student-announcements-scope"

export const dynamic = "force-dynamic"

/**
 * POST /api/announcements/unpin-all
 * Clears pinned on all announcements visible in the instructor's current course scope.
 */
export async function POST(request: NextRequest) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response

    const sessionCode = await resolveInstructorSessionCodeForScope(request)
    const visibilityFilter = await facultyAnnouncementsWhereClause(scope.course.id, sessionCode)

    const rows = await sql`
      UPDATE announcements a
      SET pinned = false, updated_at = NOW()
      WHERE ${visibilityFilter}
        AND COALESCE(a.pinned, false) = true
      RETURNING a.id
    `

    return NextResponse.json({
      message: "All announcements unpinned",
      unpinnedCount: rows.length,
    })
  } catch (error) {
    console.error("[Announcements] unpin-all error:", error)
    return NextResponse.json({ error: "Failed to unpin announcements" }, { status: 500 })
  }
}
