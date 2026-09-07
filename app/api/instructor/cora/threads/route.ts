import { type NextRequest, NextResponse } from "next/server"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import { listFacultyCoraThreads } from "@/lib/cora/faculty-cora-threads"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response

    const result = await listFacultyCoraThreads({
      instructorId: scope.instructorId,
      courseId: scope.course.id,
    })
    return NextResponse.json(result)
  } catch (error) {
    console.error("[instructor/cora/threads GET]", error)
    return NextResponse.json({ error: "Failed to load chat history" }, { status: 500 })
  }
}
