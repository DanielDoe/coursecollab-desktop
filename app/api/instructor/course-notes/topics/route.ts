import { type NextRequest, NextResponse } from "next/server"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import { resolveModuleContentSessionFilter, moduleContentSessionFilterLabel } from "@/lib/module-content-session-scope"
import { fetchCourseNoteTopicsForCourse } from "@/lib/instructor-course-note-topics"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response

    const sessionFilter = await resolveModuleContentSessionFilter(
      request,
      request.nextUrl.searchParams.get("session"),
    )
    const topics = await fetchCourseNoteTopicsForCourse({
      courseId: scope.course.id,
      sessionFilter,
    })

    const sessionLabel = moduleContentSessionFilterLabel(sessionFilter)

    return NextResponse.json({
      topics,
      courseCode: scope.course.course_code,
      session: sessionLabel,
      message:
        topics.length === 0
          ? "No note topics yet. Create a note under All Notes and assign a topic."
          : undefined,
    })
  } catch (error) {
    console.error("[instructor/course-notes/topics GET]", error)
    return NextResponse.json({ error: "Failed to load note topics" }, { status: 500 })
  }
}
