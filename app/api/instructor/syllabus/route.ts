import { type NextRequest, NextResponse } from "next/server"
import { requireCoursePermission } from "@/lib/course-permission-guard"
import { readInstructorSessionScopeFromRequest } from "@/lib/instructor-session-scope"
import {
  getOrCreateSyllabusForCourse,
  publishSyllabus,
  saveSyllabusDraft,
} from "@/lib/syllabus/syllabus-service"
import { getSyllabusCourseInfo } from "@/lib/syllabus/syllabus-course-info"
import type { CourseSyllabusPayload } from "@/lib/syllabus/types"

export async function GET(request: NextRequest) {
  try {
    const scope = await requireCoursePermission(
      request,
      ["manage_syllabus", "manage_course_settings", "view_course_content"],
      "You do not have permission to view this syllabus.",
    )
    if (!scope.ok) return scope.response

    const sessionScope = readInstructorSessionScopeFromRequest(request)
    const syllabus = await getOrCreateSyllabusForCourse(
      scope.course.id,
      scope.instructorId,
      sessionScope.sessionId,
    )
    const courseInfo = await getSyllabusCourseInfo(scope.course.id)
    const canEdit =
      scope.isInstructorOwner ||
      scope.permissions.includes("manage_syllabus") ||
      scope.permissions.includes("manage_course_settings")
    return NextResponse.json({ syllabus, courseInfo, canEdit })
  } catch (error) {
    console.error("[Instructor Syllabus] GET failed:", error)
    return NextResponse.json({ error: "Failed to load syllabus" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const scope = await requireCoursePermission(
      request,
      ["manage_syllabus", "manage_course_settings"],
      "You do not have permission to edit this syllabus.",
    )
    if (!scope.ok) return scope.response

    const body = (await request.json()) as CourseSyllabusPayload & { action?: string }
    if (!body.sections || !Array.isArray(body.sections)) {
      return NextResponse.json({ error: "sections array is required" }, { status: 400 })
    }

    const payload: CourseSyllabusPayload = {
      title: body.title,
      term: body.term,
      contentMode: body.contentMode,
      sections: body.sections,
    }

    const sessionScope = readInstructorSessionScopeFromRequest(request)

    const syllabus =
      body.action === "publish"
        ? await publishSyllabus(scope.course.id, payload, scope.instructorId, sessionScope.sessionId)
        : await saveSyllabusDraft(scope.course.id, payload, scope.instructorId, sessionScope.sessionId)

    return NextResponse.json({ syllabus, success: true })
  } catch (error) {
    console.error("[Instructor Syllabus] PUT failed:", error)
    const message = error instanceof Error ? error.message : "Failed to save syllabus"
    const status = message.includes("Upload a PDF") ? 400 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
