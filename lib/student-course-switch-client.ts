"use client"

import { studentApiFetch } from "@/lib/auth"
import { dispatchCourseSwitch } from "@/lib/data/session-events"
import {
  applyStudentSessionRefreshPayload,
  type StudentSessionRefreshResponse,
} from "@/lib/student-session-restore-client"

export type StudentCourseSwitchRequest = {
  courseId: number
  section?: string | null
  studentRowId?: number | null
}

export async function bindStudentActiveEnrollment(
  request: StudentCourseSwitchRequest,
): Promise<boolean> {
  const res = await studentApiFetch("/api/student/active-enrollment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      courseId: request.courseId,
      section: request.section,
      studentRowId: request.studentRowId,
    }),
  })
  if (!res.ok) return false
  const data = (await res.json()) as StudentSessionRefreshResponse
  const applied = applyStudentSessionRefreshPayload(data)
  if (applied) dispatchCourseSwitch()
  return applied
}
