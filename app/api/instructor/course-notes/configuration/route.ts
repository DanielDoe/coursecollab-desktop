import { type NextRequest, NextResponse } from "next/server"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import { fetchCourseNoteConfiguration } from "@/lib/instructor-course-note-topics"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response

    const config = await fetchCourseNoteConfiguration(scope.course.id)

    return NextResponse.json({
      ...config,
      courseCode: scope.course.course_code,
    })
  } catch (error) {
    console.error("[instructor/course-notes/configuration GET]", error)
    return NextResponse.json({ error: "Failed to load note configuration" }, { status: 500 })
  }
}
