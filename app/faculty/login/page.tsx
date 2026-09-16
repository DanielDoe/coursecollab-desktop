"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2 } from "lucide-react"
import { AuthGlassCard, AuthShell } from "@/components/auth/AuthShell"
import { FacultyAuthForm } from "@/components/auth/FacultyAuthForm"
import { useAuth } from "@/lib/auth-context"
import { useNativeApp } from "@/hooks/use-native-app"
import { isNativeAppSearchParams } from "@/lib/mobile-native-app"
import {
  hasRememberedFacultyUniversity,
  hydrateFacultySessionUniversityFromRemembered,
  readRememberedFacultyUniversity,
  resolveFacultyPortalUniversity,
} from "@/lib/remembered-auth"
import { readSessionSelectedUniversity } from "@/lib/universities-shared"
import { facultySessionReadyForDashboard, readFacultySession } from "@/lib/faculty-auth-flow"
import { tryRestoreFacultySessionFromRefresh, hasFacultyExplicitSignOut } from "@/lib/faculty-session-restore-client"
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
        const restored = await tryRestoreFacultySessionFromRefresh()
        if (cancelled) return

        const session = readFacultySession()
        if (session && facultySessionReadyForDashboard(session)) {
          router.replace("/faculty/dashboard")
          return
        }
        if (!restored && !readFacultySession()) {
          clearLeftoverClientSessions()
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

  const backHref =
    mounted && hasRememberedFacultyUniversity()
      ? "/auth/university?change=1&next=faculty"
      : "/auth/university?next=faculty"

  if (!mounted || !displayUniversity) {
    if (isNativeApp) {
      return (
        <div className="native-app-shell min-h-[100dvh] w-full bg-[var(--cc-background)] flex items-center justify-center px-4 py-6">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--cc-accent)]" aria-label="Loading" />
        </div>
      )
    }
    return (
      <AuthShell backHref={backHref}>
        <AuthGlassCard>
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-[var(--cc-accent)]" aria-label="Loading" />
          </div>
        </AuthGlassCard>
      </AuthShell>
    )
  }

  if (isNativeApp) {
    return (
      <div className="native-app-shell min-h-[100dvh] w-full bg-[var(--cc-background)] flex flex-col px-4 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex w-full max-w-md min-h-0 flex-1 flex-col">
          <FacultyAuthForm
          university={displayUniversity}
          initialStep={initialStep}
          nativeApp
          expired={expired}
          signedOut={signedOut}
          backHref={backHref}
          backLabel="Change university"
        />
        </div>
      </div>
    )
  }

  return (
    <AuthShell backHref={backHref} university={displayUniversity}>
      <AuthGlassCard>
        <FacultyAuthForm
          university={displayUniversity}
          initialStep={initialStep}
          expired={expired}
          signedOut={signedOut}
          backHref={backHref}
          backLabel="Change university"
        />
      </AuthGlassCard>
    </AuthShell>
  )
}
