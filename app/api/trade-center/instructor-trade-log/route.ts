import { type NextRequest, NextResponse } from "next/server"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import { loadInstructorTradeLogPayload } from "@/lib/trade-center-instructor-trade-log-data"

export const dynamic = "force-dynamic"

/**
 * GET — trade activity scoped to instructor's selected platform course (x-course-id).
 * Optional ?session= restricts to catalog section codes belonging to this course roster.
 */
export async function GET(request: NextRequest) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response

    const courseId = scope.course.id
    const { searchParams } = new URL(request.url)
    const sessionFilter = (searchParams.get("session") || "").trim()

    const limit = Math.min(300, Math.max(20, parseInt(searchParams.get("limit") || "120", 10)))

    const payload = await loadInstructorTradeLogPayload(courseId, sessionFilter, limit)

    return NextResponse.json(payload)
  } catch (e) {
    console.error("[instructor-trade-log]", e)
    return NextResponse.json({ error: "Failed to load trade log" }, { status: 500 })
  }
}
