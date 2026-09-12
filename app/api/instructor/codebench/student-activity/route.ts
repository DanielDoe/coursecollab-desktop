import { type NextRequest, NextResponse } from "next/server"
import { fetchCodebenchStudentActivity } from "@/lib/codebench-instructor-student-activity"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const scope = await requireInstructorCourse(request)
  if (!scope.ok) return scope.response

  const daysParam = Number(request.nextUrl.searchParams.get("days") ?? "30")
  const windowDays = Number.isFinite(daysParam) ? daysParam : 30

  try {
    const payload = await fetchCodebenchStudentActivity(scope.course.id, request, windowDays)
    return NextResponse.json(payload)
  } catch (error) {
    console.error("[instructor codebench student-activity]", error)
    return NextResponse.json(
      {
        windowDays: 30,
        summary: {
          totalStudents: 0,
          activeStudents: 0,
          notStartedStudents: 0,
          totalRuns: 0,
          totalSubmissions: 0,
        },
        students: [],
        recent: [],
        error: "Could not load CodeBench student activity for this course.",
      },
      { status: 500 },
    )
  }
}
