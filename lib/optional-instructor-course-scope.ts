import { type NextRequest, NextResponse } from "next/server"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"

/**
 * When request includes `x-course-id` (+ `x-instructor-id`), validate instructor owns the course.
 * Otherwise returns `{ courseId: null }` (legacy callers without headers).
 */
export async function resolveOptionalCourseScope(request: NextRequest): Promise<
  | { ok: true; courseId: null; instructorId: number | null }
  | { ok: true; courseId: number; instructorId: number }
  | { ok: false; response: NextResponse }
> {
  const courseRaw = request.headers.get("x-course-id")
  if (!courseRaw) {
    const iid = request.headers.get("x-instructor-id")
    const parsed = iid != null ? Number(iid) : null
    return {
      ok: true,
      courseId: null,
      instructorId: parsed != null && Number.isFinite(parsed) ? parsed : null,
    }
  }

  const scope = await requireInstructorCourse(request)
  if (!scope.ok) return { ok: false, response: scope.response }

  return { ok: true, courseId: scope.course.id, instructorId: scope.instructorId }
}
