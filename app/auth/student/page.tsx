"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { AuthGlassCard, AuthShell } from "@/components/auth/AuthShell"
import { StudentAuthForm } from "@/components/auth/StudentAuthForm"
import { useAuth } from "@/lib/auth-context"
import { getStudentData, isStudentAuthenticated, studentApiFetch } from "@/lib/auth"
import { readRememberedUniversity, hasRememberedStudentUniversity } from "@/lib/remembered-auth"
import { readSessionSelectedUniversity } from "@/lib/universities-shared"
import { tryRestoreStudentSessionFromRefresh, hasStudentExplicitSignOut } from "@/lib/student-session-restore-client"
import { clearLeftoverClientSessions } from "@/lib/session-restore-guard"
import { studentEnrollmentCount } from "@/lib/student-select-course"

export default function AuthStudentLoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { university, selectedUniversityId, setSelectedUniversity } = useAuth()
  const expired = searchParams.get("reason") === "session_expired"
  const signedOut = searchParams.get("signed_out") === "1"
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (searchParams.get("change") === "1" || signedOut || expired || hasStudentExplicitSignOut()) {
      clearLeftoverClientSessions()
      setReady(true)
      return
    }

    void (async () => {
      const restored = await tryRestoreStudentSessionFromRefresh()
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

  if (!ready || !university) return null

  const backHref = hasRememberedStudentUniversity() ? "/auth/university?change=1" : "/auth/university"

  return (
    <AuthShell backHref={backHref} university={university}>
      <AuthGlassCard>
        <StudentAuthForm university={university} expired={expired} />
      </AuthGlassCard>
    </AuthShell>
  )
}
