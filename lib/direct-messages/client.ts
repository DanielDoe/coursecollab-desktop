"use client"

import { getStudentAuthHeaders, studentApiFetch } from "@/lib/auth"
import { getInstructorScopeHeaders } from "@/lib/instructor-client-scope-headers"
import { instructorApiFetch } from "@/lib/instructor-api-headers"

function usesInstructorMessageApi(): boolean {
  if (typeof window === "undefined") return false
  const path = window.location.pathname
  return path.startsWith("/faculty") || path.startsWith("/instructor")
}

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

/** Message APIs with session cookies + desktop refresh header when applicable. */
export async function messageApiFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  if (usesInstructorMessageApi()) {
    return instructorApiFetch(input, init)
  }
  return studentApiFetch(input, init)
}
