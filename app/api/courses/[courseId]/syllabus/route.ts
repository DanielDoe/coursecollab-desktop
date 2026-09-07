import { type NextRequest, NextResponse } from "next/server"
import { getActorCoursePermissionCodes, requireCoursePermission } from "@/lib/course-permission-guard"
import { readInstructorSessionScopeFromRequest } from "@/lib/instructor-session-scope"
import { tryResolveInstructorCourseScope } from "@/lib/instructor-course-scope"
import { resolveStudentCourseContextFromRequest } from "@/lib/student-course-scope"
import {
  getOrCreateSyllabusForCourse,
  getSyllabusByCourseId,
  publishSyllabus,
  saveSyllabusDraft,
} from "@/lib/syllabus/syllabus-service"
import { getSyllabusCourseInfo } from "@/lib/syllabus/syllabus-course-info"
import type { CourseSyllabusPayload } from "@/lib/syllabus/types"

type RouteContext = { params: Promise<{ courseId: string }> }

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { courseId: courseIdRaw } = await context.params
    const courseId = Number(courseIdRaw)
    if (!Number.isFinite(courseId)) {
      return NextResponse.json({ error: "Invalid course ID" }, { status: 400 })
    }

    const instructorTry = await tryResolveInstructorCourseScope(request)
    if (instructorTry.ok === false && instructorTry.reason === "invalid") {
      return instructorTry.response
    }

    if (instructorTry.ok && instructorTry.course.id === courseId) {
      const permCtx = await getActorCoursePermissionCodes(request)
      if (!permCtx.ok) return permCtx.response

      const hasView = permCtx.isInstructorOwner ||
        permCtx.permissions.some((p) =>
          ["manage_syllabus", "manage_course_settings", "view_course_content"].includes(p),
        )
      if (!hasView) {
        return NextResponse.json({ error: "You do not have permission to view this syllabus." }, { status: 403 })
      }

      const sessionScope = readInstructorSessionScopeFromRequest(request)
      const syllabus = await getOrCreateSyllabusForCourse(
        courseId,
        instructorTry.instructorId,
        sessionScope.sessionId,
      )
      const courseInfo = await getSyllabusCourseInfo(courseId)
      const canEdit =
        permCtx.isInstructorOwner ||
        permCtx.permissions.includes("manage_syllabus") ||
        permCtx.permissions.includes("manage_course_settings")
      return NextResponse.json({ syllabus, courseInfo, canEdit })
    }

    const studentResolved = await resolveStudentCourseContextFromRequest(request)
    if (!studentResolved.ok) return studentResolved.response
    if (studentResolved.ctx.courseId !== courseId) {
      return NextResponse.json({ error: "Course access denied" }, { status: 403 })
    }

    const syllabus = await getSyllabusByCourseId(courseId, studentResolved.ctx.sessionId)
    if (!syllabus || syllabus.status !== "published") {
      return NextResponse.json(
        { error: "Syllabus is not yet published for this course.", syllabus: null },
        { status: 404 },
      )
    }

    const courseInfo = await getSyllabusCourseInfo(courseId)
    return NextResponse.json({
      syllabus: {
        ...syllabus,
        sections: syllabus.sections.filter((s) => s.isVisible),
      },
      courseInfo,
      canEdit: false,
    })
  } catch (error) {
    console.error("[Course Syllabus] GET failed:", error)
    return NextResponse.json({ error: "Failed to load syllabus" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { courseId: courseIdRaw } = await context.params
    const courseId = Number(courseIdRaw)
    if (!Number.isFinite(courseId)) {
      return NextResponse.json({ error: "Invalid course ID" }, { status: 400 })
    }

    const scope = await requireCoursePermission(
      request,
      ["manage_syllabus", "manage_course_settings"],
      "You do not have permission to edit this syllabus.",
    )
    if (!scope.ok) return scope.response
    if (scope.course.id !== courseId) {
      return NextResponse.json({ error: "Course mismatch" }, { status: 403 })
    }

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
        ? await publishSyllabus(courseId, payload, scope.instructorId, sessionScope.sessionId)
        : await saveSyllabusDraft(courseId, payload, scope.instructorId, sessionScope.sessionId)

    return NextResponse.json({ syllabus, success: true })
  } catch (error) {
    console.error("[Course Syllabus] PUT failed:", error)
    const message = error instanceof Error ? error.message : "Failed to save syllabus"
    const status = message.includes("Upload a PDF") ? 400 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
