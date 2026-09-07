"use client"

import { Fragment, useEffect, useRef, type ReactNode } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useInstructorDashboardV2 } from "@/components/instructor/dashboard-v2/InstructorDashboardV2Context"
import { stripCourseScopedSearchParams } from "@/lib/faculty-course-scope-routes"

/**
 * Remounts course-scoped page trees when the instructor switches courses, and
 * strips entity-specific query params so detail views do not leak across courses.
 */
export function CourseScopeRemountBoundary({ children }: { children: ReactNode }) {
  const { courseScopeVersion } = useInstructorDashboardV2()
  const pathname = usePathname()
  const router = useRouter()
  const skipNextUrlSync = useRef(true)

  useEffect(() => {
    if (skipNextUrlSync.current) {
      skipNextUrlSync.current = false
      return
    }
    if (typeof window === "undefined") return
    const nextSearch = stripCourseScopedSearchParams(window.location.search)
    const currentSearch = window.location.search
    if (nextSearch !== currentSearch) {
      router.replace(`${pathname}${nextSearch}`)
    }
  }, [courseScopeVersion, pathname, router])

  return <Fragment key={courseScopeVersion}>{children}</Fragment>
}
