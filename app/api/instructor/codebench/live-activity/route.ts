import { type NextRequest, NextResponse } from "next/server"
import { listLiveActivity } from "@/lib/codebench-live-activity-log"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import { readInstructorSessionScopeFromRequest } from "@/lib/instructor-session-scope"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const scope = await requireInstructorCourse(request)
  if (!scope.ok) return scope.response

  const limitParam = Number(request.nextUrl.searchParams.get("limit") ?? "200")
  const limit = Number.isFinite(limitParam) ? limitParam : 200

  try {
    const sessionScope = readInstructorSessionScopeFromRequest(request)
    const events = await listLiveActivity(scope.course.id, limit, sessionScope)
    return NextResponse.json({ events })
  } catch (error) {
    console.error("[instructor codebench live-activity]", error)
    return NextResponse.json({ events: [], error: "Could not load the live classroom log." }, { status: 500 })
  }
}
