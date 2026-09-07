import { type NextRequest, NextResponse } from "next/server"
import { requireInstructorSession } from "@/lib/instructor-session-auth"
import { requireBoundStudentCaller } from "@/lib/student-api-auth"

export { requireBoundStudentCaller } from "@/lib/student-api-auth"
export { requireInstructorSession } from "@/lib/instructor-session-auth"

/** Claim only — header or query. Never treat as login. */
export function claimedStudentIdFromPlaygroundRequest(request: NextRequest): string | null {
  const header = request.headers.get("x-student-id")?.trim()
  if (header) return header
  return new URL(request.url).searchParams.get("studentId")?.trim() || null
}

/**
 * Faculty preview uses an instructor session; otherwise bind the student.
 * Header-only instructor/student claims are rejected by the wrapped helpers.
 */
export async function requirePlaygroundStudentOrInstructor(
  request: NextRequest,
  claimedStudentId?: string | null,
): Promise<
  | { ok: true; role: "instructor"; instructorId: number }
  | { ok: true; role: "student"; studentDbId: number }
  | { ok: false; response: NextResponse }
> {
  const instructorHeader = request.headers.get("x-instructor-id")?.trim()
  if (instructorHeader) {
    const instructor = await requireInstructorSession(request)
    if (!instructor.ok) return instructor
    return { ok: true, role: "instructor", instructorId: instructor.instructorId }
  }

  const student = await requireBoundStudentCaller(request, claimedStudentId)
  if (student.ok) {
    return { ok: true, role: "student", studentDbId: student.studentDbId }
  }

  const instructor = await requireInstructorSession(request)
  if (instructor.ok) {
    return { ok: true, role: "instructor", instructorId: instructor.instructorId }
  }

  return student
}
