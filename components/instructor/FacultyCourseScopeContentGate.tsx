"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { useInstructorDashboardV2 } from "@/components/instructor/dashboard-v2/InstructorDashboardV2Context"
import { FacultyCourseScopePrompt } from "@/components/instructor/FacultyCourseScopePrompt"
import { CourseScopeRemountBoundary } from "@/components/instructor/CourseScopeRemountBoundary"
import {
  facultyHasSelectedCourse,
  isFacultyRouteRequiringCourseScope,
  normalizeFacultyDashboardPath,
} from "@/lib/faculty-course-scope-routes"

export function FacultyCourseScopeContentGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { courseScopeVersion, portal } = useInstructorDashboardV2()
  const [hasCourse, setHasCourse] = useState(() => facultyHasSelectedCourse())

  useEffect(() => {
    if (portal === "admin") return
    setHasCourse(facultyHasSelectedCourse())
    const sync = () => setHasCourse(facultyHasSelectedCourse())
    window.addEventListener("instructor-session-updated", sync)
    window.addEventListener("instructor-course-scope-changed", sync)
    return () => {
      window.removeEventListener("instructor-session-updated", sync)
      window.removeEventListener("instructor-course-scope-changed", sync)
    }
  }, [courseScopeVersion, portal])

  if (portal === "admin") {
    return <CourseScopeRemountBoundary>{children}</CourseScopeRemountBoundary>
  }

  const normalized = normalizeFacultyDashboardPath(pathname)
  if (hasCourse || !isFacultyRouteRequiringCourseScope(normalized)) {
    return <CourseScopeRemountBoundary>{children}</CourseScopeRemountBoundary>
  }

  return <FacultyCourseScopePrompt />
}
