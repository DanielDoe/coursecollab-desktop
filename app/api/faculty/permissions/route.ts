import { type NextRequest, NextResponse } from "next/server"
import { getUserCoursePermissions } from "@/lib/course-permissions"
import { requireInstructorOrTaCourse } from "@/lib/instructor-actor-scope"
import { provisionFacultyOwnedCourses } from "@/lib/provision-faculty-course-access"
import { isTaRole } from "@/lib/ta-permissions"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const scope = await requireInstructorOrTaCourse(request)
    if (!scope.ok) {
      return scope.response
    }

    const result = await getUserCoursePermissions(scope.actorId, scope.course.id)

    if (!isTaRole(scope.actor.role)) {
      await provisionFacultyOwnedCourses(scope.actorId)
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error("[faculty/permissions GET]", error)
    return NextResponse.json({ error: "Failed to load permissions" }, { status: 500 })
  }
}
