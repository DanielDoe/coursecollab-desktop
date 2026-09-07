"use client"

import { getStudentAuthHeaders } from "@/lib/auth"
import { getInstructorScopeHeaders } from "@/lib/instructor-client-scope-headers"

/** Auth headers for direct-message APIs (student/guest/camper or faculty). */
export function getMessageAuthHeaders(): HeadersInit {
  if (typeof window !== "undefined") {
    const path = window.location.pathname
    if (path.startsWith("/faculty") || path.startsWith("/instructor")) {
      return getInstructorScopeHeaders()
    }
    if (path.startsWith("/student") || path.startsWith("/guest")) {
      const student = getStudentAuthHeaders()
      if ("x-student-id" in student && student["x-student-id"]) return student
    }
  }
  const student = getStudentAuthHeaders()
  if ("x-student-id" in student && student["x-student-id"]) {
    return student
  }
  return getInstructorScopeHeaders()
}
