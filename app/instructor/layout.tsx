"use client"

import React, { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { InstructorHeader } from "@/components/instructor-header"
import { InstructorNotificationProvider } from "@/lib/instructor-notification-context"
import { InstructorDashboard2Banner } from "@/components/instructor/InstructorDashboard2Banner"
import {
  isFacultyDashboardV2Path,
  isFacultyPortalAppPath,
  isFacultyPortalAuthFreePath,
} from "@/lib/faculty-dashboard-path"

interface InstructorLayoutProps {
  children: React.ReactNode
}

export default function InstructorLayout({ children }: InstructorLayoutProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    if (isFacultyPortalAuthFreePath(pathname)) {
      setIsLoading(false)
      setIsAuthenticated(false)
      return
    }

    let cancelled = false

    const finishLoading = (authenticated: boolean) => {
      if (cancelled) return
      setIsAuthenticated(authenticated)
      setIsLoading(false)
    }

    const checkAuth = () => {
      try {
        const instructorSession = localStorage.getItem("instructorSession")

        if (!instructorSession) {
          finishLoading(false)
          router.push("/faculty/login")
          return
        }

        const sessionData = JSON.parse(instructorSession)
        if (!sessionData || !sessionData.id) {
          console.warn("[Layout] Session invalid, redirecting to login")
          localStorage.removeItem("instructorSession")
          finishLoading(false)
          router.push("/faculty/login")
          return
        }

        const needsCourse =
          isFacultyPortalAppPath(pathname) && !isFacultyPortalAuthFreePath(pathname)
        const skippedCourseScope = sessionData.courseScopeSkipped === true
        if (needsCourse && sessionData.selectedCourseId == null && !skippedCourseScope) {
          finishLoading(false)
          router.push("/faculty/select-course")
          return
        }

        finishLoading(true)
      } catch (error) {
        console.error("[Layout] Error checking auth:", error)
        try {
          localStorage.removeItem("instructorSession")
        } catch {
          /* ignore */
        }
        finishLoading(false)
        router.push("/faculty/login")
      }
    }

    checkAuth()

    // Never leave the shell spinner running indefinitely (stale tab, blocked redirect, etc.)
    const safetyTimer = setTimeout(() => {
      if (!cancelled) setIsLoading(false)
    }, 8000)

    return () => {
      cancelled = true
      clearTimeout(safetyTimer)
    }
  }, [router, pathname])

  if (isLoading && !isFacultyPortalAuthFreePath(pathname)) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600 dark:text-slate-400">Loading faculty portal...</p>
        </div>
      </div>
    )
  }

  if (isFacultyPortalAuthFreePath(pathname)) {
    return <>{children}</>
  }

  // Dashboard 2.0 shell (topbar + sidebar) — pathname stays /faculty/dashboard* in the browser
  if (isFacultyDashboardV2Path(pathname)) {
    return <InstructorNotificationProvider>{children}</InstructorNotificationProvider>
  }

  return (
    <InstructorNotificationProvider>
      <div className="min-h-screen bg-gradient-to-b from-slate-50 via-slate-100 to-white dark:from-slate-900 dark:via-slate-900 dark:to-slate-950">
        <InstructorHeader />
        <main className="px-6 sm:px-10 lg:px-16 xl:px-20 2xl:px-28 py-10">
          <div className="max-w-[1600px] mx-auto">
            <InstructorDashboard2Banner />
            {children}
          </div>
        </main>
      </div>
    </InstructorNotificationProvider>
  )
}
