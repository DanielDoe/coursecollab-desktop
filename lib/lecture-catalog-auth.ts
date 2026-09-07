import { type NextRequest, NextResponse } from "next/server"
import { requireCallerStudentDbId } from "@/lib/student-api-auth"
import { requireInstructorSession, unauthorizedInstructorResponse } from "@/lib/instructor-session-auth"

export type LectureCatalogCaller =
  | { ok: true; role: "student"; studentDbId: number }
  | { ok: true; role: "instructor"; instructorId: number }
  | { ok: false; response: NextResponse }

/** Legacy `/api/lectures` is not public. Identity is session proof only. */
export async function requireLectureCatalogCaller(request: NextRequest): Promise<LectureCatalogCaller> {
  const student = await requireCallerStudentDbId(request)
  if (student.ok) {
    return { ok: true, role: "student", studentDbId: student.studentDbId }
  }
  const instructor = await requireInstructorSession(request)
  if (instructor.ok) {
    return { ok: true, role: "instructor", instructorId: instructor.instructorId }
  }
  return { ok: false, response: unauthorizedInstructorResponse("Authentication required") }
}
