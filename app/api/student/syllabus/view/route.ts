import { type NextRequest, NextResponse } from "next/server"
import { resolveStudentCourseContextFromRequest } from "@/lib/student-course-scope"
import { recordSyllabusView } from "@/lib/syllabus/syllabus-view-points"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const resolved = await resolveStudentCourseContextFromRequest(request)
    if (!resolved.ok) return resolved.response

    const body = (await request.json().catch(() => ({}))) as { courseId?: number }
    const courseId = body.courseId ?? resolved.ctx.courseId

    if (Number(courseId) !== Number(resolved.ctx.courseId)) {
      return NextResponse.json({ error: "Course mismatch" }, { status: 403 })
    }

    const studentDbId = resolved.ctx.studentDbId

    const result = await recordSyllabusView(courseId, studentDbId, resolved.ctx.sessionId)

    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (error) {
    console.error("[Student Syllabus View] POST failed:", error)
    return NextResponse.json({ error: "Failed to record syllabus view" }, { status: 500 })
  }
}
