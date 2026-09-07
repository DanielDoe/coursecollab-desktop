import { type NextRequest, NextResponse } from "next/server"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import { requireBoundStudentCaller, requireCallerStudentDbId } from "@/lib/student-api-auth"

export async function requireClassroomPointsInstructor(request: NextRequest) {
  return requireInstructorCourse(request)
}

export async function requireClassroomPointsRead(request: NextRequest): Promise<
  | { ok: true; role: "instructor"; instructorId: number; courseId: number }
  | { ok: true; role: "student"; studentDbId: number }
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
  return { ok: true, role: "student", studentDbId: caller.studentDbId }
}

export async function requireClassroomPointsStudent(
  request: NextRequest,
  bodyStudentId?: unknown,
): Promise<{ ok: true; studentDbId: number } | { ok: false; response: NextResponse }> {
  const claimed =
    bodyStudentId != null && String(bodyStudentId).trim() !== "" ? String(bodyStudentId) : request.headers.get("x-student-id")
  return requireBoundStudentCaller(request, claimed)
}

