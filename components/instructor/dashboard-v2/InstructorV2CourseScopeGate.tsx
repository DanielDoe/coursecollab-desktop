"use client"

import { useEffect, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import {
  fetchFacultyCourseOptions,
  applyFacultySkipCourseScope,
  isFacultyCourseScopeSkipped,
  reconcileFacultySelectedCourse,
} from "@/lib/faculty-course-session-sync"
import { PortalWorkspaceLoading } from "@/components/dashboard-v2/PortalWorkspaceLoading"

/**
 * Ensures `instructorSession.selectedCourseId` exists before mounting v2 chrome + pages,
 * avoiding `400`/`x-course-id` races on first paint vs parent layout redirects.
 */
export function InstructorV2CourseScopeGate({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      const raw = localStorage.getItem("instructorSession")
      if (!raw) {
        router.replace("/faculty/login")
        return
      }
      let parsed: Record<string, unknown>
      try {
        parsed = JSON.parse(raw) as Record<string, unknown>
      } catch {
        router.replace("/faculty/login")
        return
      }

      try {
        const courses = await Promise.race([
          fetchFacultyCourseOptions("faculty"),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("course-scope-timeout")), 12000),
          ),
        ])
        if (cancelled) return
        const { session, changed, valid } = reconcileFacultySelectedCourse(parsed, courses)
        if (changed) {
          localStorage.setItem("instructorSession", JSON.stringify(session))
          window.dispatchEvent(new Event("instructor-session-updated"))
        }
        if (!valid) {
          if (courses.length === 0) {
            const skipped = applyFacultySkipCourseScope(parsed)
            localStorage.setItem("instructorSession", JSON.stringify(skipped))
            window.dispatchEvent(new Event("instructor-session-updated"))
          } else {
            router.replace("/faculty/select-course")
            return
          }
        }
      } catch (error) {
        console.warn("[InstructorV2CourseScopeGate] course scope check failed:", error)
        const hasCourse =
          parsed.selectedCourseId != null && String(parsed.selectedCourseId).trim() !== ""
        if (!hasCourse && !isFacultyCourseScopeSkipped(parsed)) {
          router.replace("/faculty/select-course")
          return
        }
      }

      if (!cancelled) setReady(true)
    }

    void run()

    const safetyTimer = setTimeout(() => {
      if (!cancelled) setReady(true)
    }, 15000)

    return () => {
      cancelled = true
      clearTimeout(safetyTimer)
    }
  }, [router])

  if (!ready) {
    return (
      <PortalWorkspaceLoading
        subtitle="Faculty workspace"
        title="Preparing your workspace"
        detail="Checking course scope…"
      />
    )
  }

  return <>{children}</>
}
