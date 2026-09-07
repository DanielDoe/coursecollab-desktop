"use client"

import { useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { hasRememberedStudentUniversity, hydrateSessionUniversityFromRemembered } from "@/lib/remembered-auth"
import { hasStudentExplicitSignOut } from "@/lib/student-session-restore-client"
import { clearLeftoverClientSessions, clearAllClientSessionsIncludingRefresh } from "@/lib/session-restore-guard"
import { restoreStudentSessionWithRetry } from "@/lib/student-session-restore-retry"

/** Send returning students to login when their university is remembered — never leftover local session. */
export function useRememberedStudentAuthRedirect(target: "/auth/student" = "/auth/student") {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (searchParams.get("next") === "faculty") return
    if (searchParams.get("role") === "faculty") return
    if (searchParams.get("change") === "1" || searchParams.get("signed_out") === "1" || hasStudentExplicitSignOut()) {
      clearAllClientSessionsIncludingRefresh()
      return
    }

    void (async () => {
      const restored = await restoreStudentSessionWithRetry()
      if (hasStudentExplicitSignOut()) {
        clearAllClientSessionsIncludingRefresh()
        return
      }
      if (restored) {
        router.replace("/student/dashboard-v2")
        return
      }

      clearLeftoverClientSessions()
      if (!hasRememberedStudentUniversity()) return

      hydrateSessionUniversityFromRemembered()
      router.replace(target)
    })()
  }, [router, searchParams, target])
}
