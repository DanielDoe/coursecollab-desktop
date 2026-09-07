"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { DesktopAuthLoading } from "@/components/auth/DesktopAuthLoading"
import { DesktopAuthPanel } from "@/components/auth/desktop-auth-primitives"
import { DesktopAuthShell } from "@/components/auth/DesktopAuthShell"
import { StudentAuthForm } from "@/components/auth/StudentAuthForm"
import { useAuth } from "@/lib/auth-context"
import { getStudentData, isStudentAuthenticated, studentApiFetch } from "@/lib/auth"
import { readRememberedUniversity } from "@/lib/remembered-auth"
import { readSessionSelectedUniversity } from "@/lib/universities-shared"
import { tryRestoreStudentSessionFromRefresh, hasStudentExplicitSignOut } from "@/lib/student-session-restore-client"
import { readDesktopRefreshToken } from "@/lib/desktop-refresh-token"
import { clearLeftoverClientSessions, clearAllClientSessionsIncludingRefresh } from "@/lib/session-restore-guard"
import { restoreStudentSessionWithRetry } from "@/lib/student-session-restore-retry"
import { studentEnrollmentCount } from "@/lib/student-select-course"

export default function AuthStudentLoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { university, selectedUniversityId, setSelectedUniversity } = useAuth()
  const expired = searchParams.get("reason") === "session_expired"
  const signedOut = searchParams.get("signed_out") === "1"
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (hasStudentExplicitSignOut()) {
      clearAllClientSessionsIncludingRefresh()
      setReady(true)
      return
    }

    if (signedOut) {
      clearAllClientSessionsIncludingRefresh()
      setReady(true)
      return
    }

    void (async () => {
      if (expired || searchParams.get("change") === "1") {
        const restored = await restoreStudentSessionWithRetry()
        if (restored && isStudentAuthenticated()) {
          router.replace("/student/dashboard-v2")
          return
        }
        if (expired && !readDesktopRefreshToken()) {
          sessionStorage.setItem("studentSessionExpired", "1")
          clearLeftoverClientSessions()
        }
        setReady(true)
        return
      }

      const restored = await restoreStudentSessionWithRetry()
      if (restored && isStudentAuthenticated()) {
        let count = studentEnrollmentCount(getStudentData()?.enrollments)
        if (count < 2) {
          try {
            const res = await studentApiFetch("/api/student/enrollments")
            if (res.ok) {
              const json = (await res.json()) as { enrollments?: Array<{ courseId?: number }> }
              count = studentEnrollmentCount(json.enrollments)
            }
          } catch {
            /* keep session count */
          }
        }
        router.replace(count > 1 ? "/auth/student/select-course" : "/student/dashboard-v2")
        return
      }
      clearLeftoverClientSessions()
      setReady(true)
    })()
  }, [expired, router, searchParams, signedOut])

  useEffect(() => {
    if (!ready) return
    if (selectedUniversityId) return
    const sessionUniversity = readSessionSelectedUniversity()
    if (sessionUniversity) {
      setSelectedUniversity(sessionUniversity)
      return
    }
    const remembered = readRememberedUniversity()
    if (remembered) {
      setSelectedUniversity(remembered)
      return
    }
    router.replace("/auth/university")
  }, [ready, selectedUniversityId, router, setSelectedUniversity])

  if (!ready || !university) {
    return (
      <DesktopAuthShell>
        <DesktopAuthLoading label="Preparing sign in" />
      </DesktopAuthShell>
    )
  }

  return (
    <DesktopAuthShell
      sidebarTagline={`Sign in to ${university.name} to access your courses and AI tools.`}
    >
      <DesktopAuthPanel>
        <StudentAuthForm
          university={university}
          expired={expired}
          variant="desktop"
          backHref="/auth/university?change=1"
        />
      </DesktopAuthPanel>
    </DesktopAuthShell>
  )
}
