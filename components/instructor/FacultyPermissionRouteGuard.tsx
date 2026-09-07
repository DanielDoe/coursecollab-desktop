"use client"

import { useEffect, useMemo, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { getInstructorData } from "@/lib/auth"
import { FACULTY_DASHBOARD_BASE, isFacultyRouteAllowed } from "@/lib/faculty-portal-nav-config"
import { isTaPolicyForbiddenPath, isTaRole } from "@/lib/ta-permissions"
import { buildInstructorApiHeaders } from "@/lib/instructor-api-headers"

export function FacultyPermissionRouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [permissions, setPermissions] = useState<string[]>(() => {
    const data = getInstructorData()
    return (data?.coursePermissions as string[]) ?? []
  })

  useEffect(() => {
    const syncFromSession = () => {
      const data = getInstructorData()
      if (data?.coursePermissions?.length) {
        setPermissions(data.coursePermissions as string[])
        return
      }
      void refreshPermissions()
    }
    syncFromSession()
    window.addEventListener("instructor-session-updated", syncFromSession)
    window.addEventListener("instructor-course-scope-changed", syncFromSession)
    return () => {
      window.removeEventListener("instructor-session-updated", syncFromSession)
      window.removeEventListener("instructor-course-scope-changed", syncFromSession)
    }
  }, [])

  async function refreshPermissions() {
    const data = getInstructorData()
    if (!data?.selectedCourseId) return
    try {
      const res = await fetch("/api/faculty/permissions", { headers: buildInstructorApiHeaders() })
      const json = await res.json()
      if (!res.ok) return
      setPermissions(json.permissions ?? [])
      const raw = localStorage.getItem("instructorSession")
      if (raw) {
        const session = JSON.parse(raw)
        session.coursePermissions = json.permissions
        session.staffRoleForCourse = json.staffRole
        localStorage.setItem("instructorSession", JSON.stringify(session))
      }
    } catch {
      /* ignore */
    }
  }

  const blocked = useMemo(() => {
    if (!pathname?.startsWith(FACULTY_DASHBOARD_BASE) && !pathname?.startsWith("/instructor/dashboard-v2")) {
      return false
    }
    const normalized = pathname.replace("/instructor/dashboard-v2", FACULTY_DASHBOARD_BASE)
    const actor = getInstructorData()
    if (isTaRole(actor?.role) && isTaPolicyForbiddenPath(normalized)) {
      return true
    }
    const hasCourse =
      actor?.selectedCourseId != null && String(actor.selectedCourseId).trim() !== ""
    // Without a course, keep navigation open; course-scoped pages show a select-course prompt instead.
    if (!hasCourse) return false
    if (permissions.length === 0) return false
    return !isFacultyRouteAllowed(normalized, permissions)
  }, [pathname, permissions])

  useEffect(() => {
    if (blocked) router.replace(FACULTY_DASHBOARD_BASE)
  }, [blocked, router])

  if (blocked) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-slate-200/80 bg-white/90 p-8 text-center shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Not available</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          You do not have permission to open this page in the selected course. Choose another course or contact your
          instructor.
        </p>
      </div>
    )
  }

  return <>{children}</>
}
