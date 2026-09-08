"use client"

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { Loader2 } from "lucide-react"
import { InstructorDashboardV2Provider, useInstructorDashboardV2 } from "@/components/instructor/dashboard-v2/InstructorDashboardV2Context"
import { InstructorTopbarV2 } from "@/components/instructor/dashboard-v2/InstructorTopbarV2"
import { InstructorSidebarV2 } from "@/components/instructor/dashboard-v2/InstructorSidebarV2"
import { InstructorDashboardBreadcrumbs } from "@/components/instructor/dashboard-v2/InstructorDashboardBreadcrumbs"
import { InstructorV2CourseScopeGate } from "@/components/instructor/dashboard-v2/InstructorV2CourseScopeGate"
import { InstructorCourseSwitchSplash } from "@/components/instructor/dashboard-v2/InstructorCourseSwitchSplash"
import { dashboardV2ShellMainClass, isInstructorImmersivePreviewPath } from "@/lib/dashboard-v2-layout"
import { magnificShellClass, magnificShellCardClass, magnificMergedMainClass } from "@/lib/appearance/magnific-shell"
import { cn } from "@/lib/utils"
import { FacultyPermissionRouteGuard } from "@/components/instructor/FacultyPermissionRouteGuard"
import { FacultyCourseScopeContentGate } from "@/components/instructor/FacultyCourseScopeContentGate"
import { PlatformActivityTracker } from "@/components/platform-activity-tracker"
import { PresenceSelfProvider } from "@/components/presence/PresenceSelfProvider"
import { FacultyModuleThemeProvider } from "@/components/instructor/dashboard-v2/FacultyModuleThemeProvider"
import {
  facultySessionNeedsPasswordChange,
  isFacultyAuthenticated,
  readFacultySession,
} from "@/lib/faculty-auth-flow"
import { hasFacultyExplicitSignOut } from "@/lib/faculty-session-restore-client"
import { restoreFacultySessionWithRetry } from "@/lib/faculty-session-restore-retry"
import { readDesktopRefreshToken } from "@/lib/desktop-refresh-token"
import { isDesktopAppShell } from "@/lib/desktop-auth-policy"
import { FacultyAccessRequestsMobileStrip } from "@/components/instructor/FacultyAccessRequestsMobileStrip"
import {
  DashboardChromeTitleProvider,
  DashboardChromeTitleSlots,
} from "@/components/dashboard-v2/DashboardChromeTitlePortal"
import { FacultyExchangeProvenanceStrip } from "@/components/instructor/FacultyExchangeProvenanceStrip"

function ImmersivePreviewSidebarEffect() {
  const pathname = usePathname()
  const { setSidebarCollapsed } = useInstructorDashboardV2()
  const isImmersive = isInstructorImmersivePreviewPath(pathname)

  useEffect(() => {
    if (isImmersive) {
      setSidebarCollapsed(true)
    }
  }, [isImmersive, setSidebarCollapsed])

  return null
}

function CoraImmersiveSidebarEffect() {
  const { coraImmersive, setSidebarCollapsed } = useInstructorDashboardV2()

  useEffect(() => {
    if (!coraImmersive) return
    setSidebarCollapsed(true)
    return () => setSidebarCollapsed(false)
  }, [coraImmersive, setSidebarCollapsed])

  return null
}

/** Close mobile drawer on route change; desktop rail stays as the user left it. */
function MobileSidebarCloseOnNavigate() {
  const pathname = usePathname()
  const { setMobileSidebarOpen } = useInstructorDashboardV2()
  useEffect(() => {
    setMobileSidebarOpen(false)
  }, [pathname, setMobileSidebarOpen])
  return null
}

function DashboardContent({
  children,
  merged = false,
}: {
  children: React.ReactNode
  merged?: boolean
}) {
  const { coraImmersive } = useInstructorDashboardV2()
  const pathname = usePathname()
  const isImmersive = isInstructorImmersivePreviewPath(pathname) || coraImmersive
  const showBreadcrumbs = !merged && !isImmersive
  const contentPadding = isImmersive
    ? "p-0"
    : merged
      ? magnificMergedMainClass
      : dashboardV2ShellMainClass
  const mainLayoutClass = isImmersive
    ? "flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-hidden"
    : merged
      ? "flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto overscroll-contain has-[_[data-scroll-mode=panel]]:overflow-y-hidden"
      : "min-h-0 flex-1 min-w-0 overflow-x-hidden overflow-y-auto"

  return (
    <main className={cn(mainLayoutClass, contentPadding)}>
      {showBreadcrumbs ? <InstructorDashboardBreadcrumbs /> : null}
      {showBreadcrumbs ? <FacultyExchangeProvenanceStrip /> : null}
      {showBreadcrumbs ? <FacultyAccessRequestsMobileStrip className="mb-3 lg:hidden" /> : null}
      {merged && !isImmersive ? <DashboardChromeTitleSlots /> : null}
      <div className={cn(!isImmersive && "flex min-h-0 min-w-0 flex-1 flex-col")}>
        <FacultyModuleThemeProvider>
          <FacultyPermissionRouteGuard>
            <FacultyCourseScopeContentGate>{children}</FacultyCourseScopeContentGate>
          </FacultyPermissionRouteGuard>
        </FacultyModuleThemeProvider>
      </div>
    </main>
  )
}

function DashboardShellBody({ children }: { children: React.ReactNode }) {
  const { coraImmersive } = useInstructorDashboardV2()
  const pathname = usePathname()
  const isImmersive = isInstructorImmersivePreviewPath(pathname) || coraImmersive
  const useMergedCard = !isImmersive

  return (
    <DashboardChromeTitleProvider>
    <div
      className={cn(
        "flex min-h-0 flex-1 gap-3 overflow-hidden p-3 sm:gap-4 sm:p-4",
        magnificShellClass,
      )}
    >
      {!coraImmersive ? <InstructorSidebarV2 /> : null}
      <div
        className={cn(
          "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden",
          !useMergedCard && "gap-3 sm:gap-4",
        )}
      >
        {useMergedCard ? (
          <div
            data-merged-content-shell
            className={cn(
              magnificShellCardClass,
              "flex min-h-0 flex-1 flex-col gap-0 overflow-hidden",
            )}
          >
            <InstructorTopbarV2 merged />
            <DashboardContent merged>{children}</DashboardContent>
          </div>
        ) : (
          <>
            {!coraImmersive ? <InstructorTopbarV2 /> : null}
            <DashboardContent>{children}</DashboardContent>
          </>
        )}
      </div>
    </div>
    </DashboardChromeTitleProvider>
  )
}

function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden">
      <ImmersivePreviewSidebarEffect />
      <CoraImmersiveSidebarEffect />
      <MobileSidebarCloseOnNavigate />
      <DashboardShellBody>{children}</DashboardShellBody>
    </div>
  )
}

export default function InstructorDashboardV2Layout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const isImmersiveRoute = isInstructorImmersivePreviewPath(pathname)
  const [authReady, setAuthReady] = useState(false)
  const [sessionValid, setSessionValid] = useState(false)

  useEffect(() => {
    if (hasFacultyExplicitSignOut()) {
      setAuthReady(true)
      setSessionValid(false)
      return
    }
    void restoreFacultySessionWithRetry().finally(() => {
      setAuthReady(true)
      setSessionValid(isFacultyAuthenticated())
    })
  }, [])

  useEffect(() => {
    const syncSession = () => {
      setSessionValid(isFacultyAuthenticated())
    }
    window.addEventListener("cc-session-restored", syncSession)
    window.addEventListener("faculty-session-ready", syncSession)
    window.addEventListener("instructor-session-updated", syncSession)
    return () => {
      window.removeEventListener("cc-session-restored", syncSession)
      window.removeEventListener("faculty-session-ready", syncSession)
      window.removeEventListener("instructor-session-updated", syncSession)
    }
  }, [])

  useEffect(() => {
    if (!authReady) return

    const onFacultyDashboard =
      pathname?.startsWith("/instructor/dashboard-v2") || pathname?.startsWith("/faculty/dashboard")

    if (!onFacultyDashboard) {
      setSessionValid(isFacultyAuthenticated())
      return
    }

    const session = readFacultySession()
    if (session) {
      setSessionValid(true)
      if (facultySessionNeedsPasswordChange(session)) {
        router.push("/faculty/change-password")
      }
      return
    }

    let cancelled = false
    void restoreFacultySessionWithRetry({ maxAttempts: 2 }).then((restored) => {
      if (cancelled) return
      const nextSession = readFacultySession()
      if ((restored || nextSession) && nextSession) {
        setSessionValid(true)
        if (facultySessionNeedsPasswordChange(nextSession)) {
          router.push("/faculty/change-password")
        }
        return
      }
      const keepRefreshFallback = isDesktopAppShell() && Boolean(readDesktopRefreshToken())
      if (keepRefreshFallback) return
      setSessionValid(false)
      router.push("/faculty/login")
    })

    return () => {
      cancelled = true
    }
  }, [authReady, router, pathname])

  if (!authReady || !sessionValid) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--cc-background)] text-[var(--cc-text-muted)]">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--cc-accent)]" aria-label="Loading session" />
      </div>
    )
  }

  return (
    <InstructorDashboardV2Provider>
      <PresenceSelfProvider>
      <InstructorV2CourseScopeGate>
        <div
          className={`instructor-dashboard-v2 bg-[var(--cc-background)] text-[var(--cc-text)] antialiased ${
            isImmersiveRoute
              ? "flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden"
              : "flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden"
          }`}
        >
        {/* Layer 1: Emerald & gold atmospheric gradients (instructor theme) */}
        <div
          className="fixed inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(circle at 15% 15%, rgba(16,185,129,0.06), transparent 45%), radial-gradient(circle at 85% 85%, rgba(234,170,0,0.04), transparent 45%)",
          }}
        />
        <div
          className="fixed inset-0 pointer-events-none dark:block hidden"
          style={{
            background:
              "radial-gradient(circle at 50% 50%, rgba(16,185,129,0.03), transparent 50%)",
          }}
        />
        {/* Dark mode glow blobs */}
        <div
          className="fixed top-0 left-1/4 w-96 h-96 rounded-full pointer-events-none opacity-20 hidden dark:block"
          style={{
            background: "radial-gradient(circle, rgba(16,185,129,0.15), transparent 70%)",
            filter: "blur(60px)",
          }}
        />
        <div
          className="fixed bottom-0 right-1/4 w-96 h-96 rounded-full pointer-events-none opacity-12 hidden dark:block"
          style={{
            background: "radial-gradient(circle, rgba(234,170,0,0.1), transparent 70%)",
            filter: "blur(80px)",
          }}
        />

        <DashboardShell>{children}</DashboardShell>
        <InstructorCourseSwitchSplash />
        <PlatformActivityTracker />
        </div>
      </InstructorV2CourseScopeGate>
      </PresenceSelfProvider>
    </InstructorDashboardV2Provider>
  )
}
