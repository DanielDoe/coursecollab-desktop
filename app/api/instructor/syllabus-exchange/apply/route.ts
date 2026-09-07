import { NextRequest, NextResponse } from "next/server"
import { requireCoursePermission } from "@/lib/course-permission-guard"
import { readInstructorSessionScopeFromRequest } from "@/lib/instructor-session-scope"
import { applySyllabusTemplate } from "@/lib/syllabus-exchange/service"

export const dynamic = "force-dynamic"

/** Clone a discovered syllabus into the instructor's current course section (draft). */
export async function POST(request: NextRequest) {
  try {
    const scope = await requireCoursePermission(
      request,
      ["manage_syllabus", "manage_course_settings"],
      "You do not have permission to edit this syllabus.",
    )
    if (!scope.ok) return scope.response

    const body = (await request.json()) as { sourceSyllabusId?: number }
    const sourceSyllabusId = Number(body.sourceSyllabusId)
    if (!Number.isFinite(sourceSyllabusId) || sourceSyllabusId <= 0) {
      return NextResponse.json({ error: "sourceSyllabusId is required" }, { status: 400 })
    }

    const sessionScope = readInstructorSessionScopeFromRequest(request)

    const syllabus = await applySyllabusTemplate({
      sourceSyllabusId,
      destinationCourseId: scope.course.id,
      destinationSessionId: sessionScope.sessionId,
      destinationInstructorId: scope.instructorId,
    })

    return NextResponse.json({ syllabus, success: true })
  } catch (error) {
    console.error("[syllabus-exchange/apply]", error)
    const message = error instanceof Error ? error.message : "Failed to apply syllabus template"
    const status =
      message.includes("not found") || message.includes("already assigned") ? 400 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
