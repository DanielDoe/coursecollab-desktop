import { type NextRequest, NextResponse } from "next/server"
import { requireCoursePermission } from "@/lib/course-permission-guard"
import {
  getRequestById,
  getRequestDashboardStats,
  syncRequestStatus,
} from "@/lib/schedule-adjustment/workflow-service"
import { INSTITUTIONAL_SAFEGUARD_NOTICE } from "@/lib/schedule-adjustment/types"
import { readInstructorSessionScopeFromRequest } from "@/lib/instructor-session-scope"
import { instructorCanAccessScheduleRequest } from "@/lib/schedule-adjustment/section-scope"

export const dynamic = "force-dynamic"

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireCoursePermission(request, [
      "manage_course_settings",
      "view_course_content",
      "view_analytics",
    ])
    if (!ctx.ok) return ctx.response

    const { id } = await context.params
    const requestId = Number(id)
    let row = await getRequestById(requestId)
    if (!row || row.course_id !== ctx.course.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    const sessionScope = readInstructorSessionScopeFromRequest(request)
    if (!instructorCanAccessScheduleRequest(row, ctx.course.id, sessionScope.sessionId)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    row = await syncRequestStatus(row)
    const stats = await getRequestDashboardStats(requestId)

    return NextResponse.json({
      success: true,
      ...stats,
      safeguardNotice: INSTITUTIONAL_SAFEGUARD_NOTICE,
    })
  } catch (error) {
    console.error("[Schedule Adjustment GET]", error)
    return NextResponse.json({ success: false, error: "Failed to load request" }, { status: 500 })
  }
}
