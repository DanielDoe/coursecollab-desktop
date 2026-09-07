import { type NextRequest, NextResponse } from "next/server"
import { resolveStudentCourseContextFromRequest } from "@/lib/student-course-scope"
import { getSyllabusByCourseId } from "@/lib/syllabus/syllabus-service"
import { getSyllabusCourseInfo } from "@/lib/syllabus/syllabus-course-info"

export async function GET(request: NextRequest) {
  try {
    const resolved = await resolveStudentCourseContextFromRequest(request)
    if (!resolved.ok) return resolved.response

    const syllabus = await getSyllabusByCourseId(resolved.ctx.courseId, resolved.ctx.sessionId)
    if (!syllabus || syllabus.status !== "published") {
      return NextResponse.json(
        { error: "Syllabus is not yet published for this course.", syllabus: null },
        { status: 404 },
      )
    }

    const courseInfo = await getSyllabusCourseInfo(resolved.ctx.courseId)
    const visibleSections = syllabus.sections.filter((s) => s.isVisible)
    return NextResponse.json({
      syllabus: { ...syllabus, sections: visibleSections },
      courseInfo,
      canEdit: false,
    })
  } catch (error) {
    console.error("[Student Syllabus] GET failed:", error)
    return NextResponse.json({ error: "Failed to load syllabus" }, { status: 500 })
  }
}
