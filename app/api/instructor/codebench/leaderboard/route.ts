import { type NextRequest, NextResponse } from "next/server"
import { fetchInstructorCodebenchLeaderboard } from "@/lib/codebench-instructor-leaderboard"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const scope = await requireInstructorCourse(request)
  if (!scope.ok) return scope.response

  try {
    const leaderboard = await fetchInstructorCodebenchLeaderboard(scope.course.id, request)
    return NextResponse.json({ leaderboard })
  } catch (error) {
    console.error("[instructor codebench leaderboard]", error)
    return NextResponse.json({ error: "Could not load the CodeBench leaderboard." }, { status: 500 })
  }
}
