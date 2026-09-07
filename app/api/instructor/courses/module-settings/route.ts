import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import { mergeCourseModuleSettings, type CourseModuleSettings } from "@/lib/course-module-settings"

export const dynamic = "force-dynamic"

export async function PATCH(request: NextRequest) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response

    const body = await request.json()
    const incoming = body.module_settings as Partial<CourseModuleSettings> | undefined
    if (!incoming || typeof incoming !== "object") {
      return NextResponse.json({ error: "module_settings required" }, { status: 400 })
    }

    const merged = mergeCourseModuleSettings(incoming)

    await sql`
      UPDATE courses
      SET module_settings = ${JSON.stringify(merged)}::jsonb, updated_at = NOW()
      WHERE id = ${scope.course.id} AND instructor_id = ${scope.instructorId}
    `

    return NextResponse.json({ module_settings: merged, success: true })
  } catch (error) {
    console.error("[instructor/courses/module-settings]", error)
    return NextResponse.json({ error: "Failed to update course settings" }, { status: 500 })
  }
}
