"use client"

import { useEffect, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  hasRememberedFacultyUniversity,
  hydrateFacultySessionUniversityFromRemembered,
  readRememberedFacultyUniversity,
} from "@/lib/remembered-auth"
import {
  facultySessionNeedsPasswordChange,
  facultySessionReadyForDashboard,
  readFacultySession,
} from "@/lib/faculty-auth-flow"
import { hasFacultyExplicitSignOut, tryRestoreFacultySessionFromRefresh } from "@/lib/faculty-session-restore-client"
import { clearLeftoverClientSessions } from "@/lib/session-restore-guard"

/** Skip university picker when faculty university is remembered — never leftover local session. */
export function useRememberedFacultyAuthRedirect(userHasPicked?: () => boolean) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const userHasPickedRef = useRef(userHasPicked)
  userHasPickedRef.current = userHasPicked

  useEffect(() => {
    if (searchParams.get("next") !== "faculty") return
    if (searchParams.get("change") === "1" || searchParams.get("signed_out") === "1" || hasFacultyExplicitSignOut()) {
      clearLeftoverClientSessions()
      return
    }

    let cancelled = false
    void (async () => {
      const restored = await tryRestoreFacultySessionFromRefresh({
        expectedUniversityId: () => readRememberedFacultyUniversity()?.id,
      })
      if (cancelled || userHasPickedRef.current?.()) return
      if (hasFacultyExplicitSignOut()) {
        clearLeftoverClientSessions()
        return
      }
      if (restored) {
        const session = readFacultySession()
        if (session && !facultySessionNeedsPasswordChange(session) && facultySessionReadyForDashboard(session)) {
          router.replace("/faculty/dashboard")
          return
        }
        router.replace("/faculty/login")
        return
      }

      clearLeftoverClientSessions()
      if (!hasRememberedFacultyUniversity()) return
      hydrateFacultySessionUniversityFromRemembered()
      router.replace("/faculty/login")
    })()
    return () => {
      cancelled = true
    }
  }, [router, searchParams])
}
