"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { DesktopAuthLoading } from "@/components/auth/DesktopAuthLoading"
import { DesktopAuthPanel } from "@/components/auth/desktop-auth-primitives"
import { DesktopAuthShell } from "@/components/auth/DesktopAuthShell"
import { FacultyAuthForm } from "@/components/auth/FacultyAuthForm"
import { useAuth } from "@/lib/auth-context"
import { useNativeApp } from "@/hooks/use-native-app"
import { isNativeAppSearchParams } from "@/lib/mobile-native-app"
import {
  readRememberedFacultyUniversity,
  resolveFacultyPortalUniversity,
} from "@/lib/remembered-auth"
import { facultySessionReadyForDashboard, readFacultySession } from "@/lib/faculty-auth-flow"
import { hasFacultyExplicitSignOut } from "@/lib/faculty-session-restore-client"
import { restoreFacultySessionWithRetry } from "@/lib/faculty-session-restore-retry"
import { readDesktopRefreshToken } from "@/lib/desktop-refresh-token"
import { isDesktopAppShell } from "@/lib/desktop-auth-policy"
import { clearLeftoverClientSessions } from "@/lib/session-restore-guard"

function resolveFacultyLoginUniversity() {
  return resolveFacultyPortalUniversity()
}

export default function FacultyLoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const uaNative = useNativeApp()
  const isNativeApp = isNativeAppSearchParams(searchParams) || uaNative
  const { university, setSelectedUniversity } = useAuth()
  const [mounted, setMounted] = useState(false)
  const [resolvedUniversity, setResolvedUniversity] = useState<ReturnType<typeof readRememberedFacultyUniversity>>(null)
  const stepParam = searchParams.get("step")
  const initialStep = stepParam === "course" ? "course" : "login"
  const expired = searchParams.get("reason") === "session_expired"
  const signedOut = searchParams.get("signed_out") === "1"
  const displayUniversity = university ?? resolvedUniversity
  const backHref = "/auth/university?next=faculty&change=1"

  useEffect(() => {
    setMounted(true)
    const remembered = resolveFacultyLoginUniversity()
    if (remembered) setResolvedUniversity(remembered)
  }, [])

  useEffect(() => {
    if (university) setResolvedUniversity(university)
  }, [university])

  useEffect(() => {
    if (signedOut || hasFacultyExplicitSignOut()) {
      clearLeftoverClientSessions()
      if (!resolveFacultyLoginUniversity()) {
        router.replace("/auth/university?next=faculty")
      }
      return
    }

    let cancelled = false

    const run = async () => {
      const onCourseStep = initialStep === "course"
      const localSession = readFacultySession()

      if (onCourseStep) {
        if (!localSession) {
          router.replace("/faculty/login")
          return
        }
      } else if (expired) {
        clearLeftoverClientSessions()
      }

      if (!onCourseStep) {
        const restored = await restoreFacultySessionWithRetry()
        if (cancelled) return

        const session = readFacultySession()
        if (session && facultySessionReadyForDashboard(session)) {
          router.replace("/faculty/dashboard")
          return
        }
        if (!restored && !readFacultySession()) {
          const keepRefreshFallback =
            isDesktopAppShell() && Boolean(readDesktopRefreshToken())
          if (!keepRefreshFallback) {
            clearLeftoverClientSessions()
          }
        }
      }

      const resolved = resolveFacultyLoginUniversity()
      if (resolved) {
        setResolvedUniversity(resolved)
        if (!university || university.id !== resolved.id) {
          setSelectedUniversity(resolved)
        }
        return
      }

      router.replace("/auth/university?next=faculty")
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [expired, initialStep, router, setSelectedUniversity, signedOut, university])

  if (!mounted || !displayUniversity) {
    if (isNativeApp) {
      return (
        <div className="native-app-shell min-h-[100dvh] w-full bg-[var(--cc-background)] flex items-center justify-center px-4 py-6">
          <DesktopAuthLoading label="Preparing faculty sign in" compact />
        </div>
      )
    }
    return (
      <DesktopAuthShell>
        <DesktopAuthLoading label="Preparing faculty sign in" />
      </DesktopAuthShell>
    )
  }

  if (isNativeApp) {
    return (
      <div className="native-app-shell min-h-[100dvh] w-full bg-[var(--cc-background)] flex flex-col px-4 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex w-full max-w-md min-h-0 flex-1 flex-col">
          <FacultyAuthForm university={displayUniversity} initialStep={initialStep} nativeApp expired={expired} signedOut={signedOut} />
        </div>
      </div>
    )
  }

  return (
    <DesktopAuthShell sidebarTagline={`Faculty sign-in for ${displayUniversity.name}.`}>
      <DesktopAuthPanel>
        <FacultyAuthForm
          university={displayUniversity}
          initialStep={initialStep}
          expired={expired}
          signedOut={signedOut}
          variant="desktop"
          backHref={backHref}
        />
      </DesktopAuthPanel>
    </DesktopAuthShell>
  )
}
