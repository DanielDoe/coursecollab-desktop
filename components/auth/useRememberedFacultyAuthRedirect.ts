"use client"

import { useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  hasRememberedFacultyUniversity,
  hydrateFacultySessionUniversityFromRemembered,
} from "@/lib/remembered-auth"
import {
  facultySessionNeedsPasswordChange,
  facultySessionReadyForDashboard,
  readFacultySession,
} from "@/lib/faculty-auth-flow"
import { hasFacultyExplicitSignOut } from "@/lib/faculty-session-restore-client"
import { restoreFacultySessionWithRetry } from "@/lib/faculty-session-restore-retry"
import { readDesktopRefreshToken } from "@/lib/desktop-refresh-token"
import { isDesktopAppShell } from "@/lib/desktop-auth-policy"
import { clearLeftoverClientSessions } from "@/lib/session-restore-guard"

/** Skip university picker when faculty university is remembered — never leftover local session. */
export function useRememberedFacultyAuthRedirect() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (searchParams.get("next") !== "faculty") return
    if (searchParams.get("change") === "1" || searchParams.get("signed_out") === "1" || hasFacultyExplicitSignOut()) {
      clearLeftoverClientSessions()
      return
    }

    void (async () => {
      const restored = await restoreFacultySessionWithRetry()
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

      const keepRefreshFallback = isDesktopAppShell() && Boolean(readDesktopRefreshToken())
      if (!keepRefreshFallback) {
        clearLeftoverClientSessions()
      }
      if (!hasRememberedFacultyUniversity()) return
      hydrateFacultySessionUniversityFromRemembered()
      router.replace("/faculty/login")
    })()
  }, [router, searchParams])
}
