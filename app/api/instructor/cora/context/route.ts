import { type NextRequest, NextResponse } from "next/server"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import {
  fetchFacultyContextForCora,
  formatFacultyContextForPrompt,
} from "@/lib/cora/fetch-faculty-context"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response

    const context = await fetchFacultyContextForCora({
      courseId: scope.course.id,
      instructorId: scope.instructorId,
      courseCode: scope.course.course_code ?? null,
      courseTitle: scope.course.course_title ?? null,
    })

    return NextResponse.json({
      context,
      promptBlock: formatFacultyContextForPrompt(context),
    })
  } catch (error) {
    console.error("[instructor/cora/context]", error)
    return NextResponse.json({ error: "Failed to load course context" }, { status: 500 })
  }
}
