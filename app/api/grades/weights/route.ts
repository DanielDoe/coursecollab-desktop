import { NextRequest, NextResponse } from "next/server"
import { getGradeWeights } from "@/lib/grades"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response

    const { searchParams } = new URL(request.url)
    const session = searchParams.get("session") || "ALL"

    const weights = await getGradeWeights(session, scope.course.id)

    if (!weights) {
      return NextResponse.json({ error: "Grade weights not found" }, { status: 404 })
    }

    return NextResponse.json({
      weights: {
        quiz: Number(weights.quiz_weight),
        homework: Number(weights.homework_weight),
        midterm: Number(weights.midterm_weight),
        final: Number(weights.final_weight),
        attendance: Number(weights.attendance_weight),
        project: Number(weights.project_weight),
        classroom: Number(weights.classroom_weight),
        engagement: Number(weights.engagement_weight),
        total: Number(weights.total_weight),
      },
      session: weights.session,
      courseId: scope.course.id,
    })
  } catch (error) {
    console.error("Error fetching grade weights:", error)
    return NextResponse.json({ error: "Failed to fetch grade weights" }, { status: 500 })
  }
}
