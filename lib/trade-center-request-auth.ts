import { type NextRequest, NextResponse } from "next/server"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import { requireCallerStudentDbId } from "@/lib/student-api-auth"

export async function requireTradeCenterConfigRead(request: NextRequest): Promise<
  | { ok: true; role: "instructor"; instructorId: number; courseId: number }
  | { ok: true; role: "student"; studentId: number }
  | { ok: false; response: NextResponse }
> {
  const instructorId = request.headers.get("x-instructor-id")?.trim()
  if (instructorId) {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope
    return { ok: true, role: "instructor", instructorId: scope.instructorId, courseId: scope.course.id }
  }

  const caller = await requireCallerStudentDbId(request)
  if (!caller.ok) return caller
  return { ok: true, role: "student", studentId: caller.studentDbId }
}
