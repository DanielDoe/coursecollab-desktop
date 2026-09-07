import { type NextRequest, NextResponse } from "next/server"
import { getFacultyAskCoraInsights } from "@/lib/cora/assessment-policy-analytics"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const scope = await requireInstructorCourse(request)
  if (!scope.ok) return scope.response
  const insights = await getFacultyAskCoraInsights(scope.course.id)
  return NextResponse.json({ insights })
}
