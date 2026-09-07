"use client"

import { useCallback, useEffect, useState } from "react"
import { getAdminData, getInstructorData, getStudentData } from "@/lib/auth"
import { COURSE_SWITCH_EVENT, SESSION_RESET_EVENT, type ClientScope } from "@/lib/data/types"

export function readClientScope(): ClientScope {
  if (typeof window === "undefined") {
    return { role: null, userId: null, courseId: null, section: null }
  }

  const student = getStudentData()
  if (student) {
    return {
      role: student.isPlatformGuest ? "guest" : "student",
      userId: String(student.databaseId ?? student.id),
      courseId: student.courseId ?? null,
      section: student.section ?? null,
    }
  }

  const instructor = getInstructorData()
  if (instructor) {
    return {
      role: "faculty",
      userId: String(instructor.id),
      courseId: instructor.selectedCourseId ?? null,
      section: instructor.selectedSessionCode ?? null,
    }
  }

  const admin = getAdminData()
  if (admin) {
    return {
      role: "admin",
      userId: String(admin.id),
      courseId: admin.selectedCourseId ?? null,
      section: null,
    }
  }

  return { role: null, userId: null, courseId: null, section: null }
}

export function scopeToken(scope: ClientScope): string {
  return [scope.role ?? "anon", scope.userId ?? "0", scope.courseId ?? "none", scope.section ?? "all"].join(":")
}

export function useClientScope(): ClientScope {
  const [scope, setScope] = useState<ClientScope>(readClientScope)

  const refresh = useCallback(() => {
    setScope(readClientScope())
  }, [])

  useEffect(() => {
    refresh()
    window.addEventListener("storage", refresh)
    window.addEventListener(SESSION_RESET_EVENT, refresh)
    window.addEventListener(COURSE_SWITCH_EVENT, refresh)
    window.addEventListener("instructor-scope-changed", refresh)
    window.addEventListener("instructor-session-updated", refresh)
    return () => {
      window.removeEventListener("storage", refresh)
      window.removeEventListener(SESSION_RESET_EVENT, refresh)
      window.removeEventListener(COURSE_SWITCH_EVENT, refresh)
      window.removeEventListener("instructor-scope-changed", refresh)
      window.removeEventListener("instructor-session-updated", refresh)
    }
  }, [refresh])

  return scope
}
