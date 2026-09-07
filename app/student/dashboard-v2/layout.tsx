"use client"

import dynamic from "next/dynamic"
import { useEffect, useState, useRef } from "react"
import { useRouter, usePathname } from "next/navigation"
import { getStudentData, patchStudentSessionSection, patchStudentSessionPasswordChanged, studentApiFetch, studentSessionReportsPasswordChanged, wasSessionExpired } from "@/lib/auth"
import { setDashboardV2Preference } from "@/lib/student-dashboard-paths"
import { DashboardV2Provider, useDashboardV2 } from "@/components/student/dashboard-v2/DashboardV2Context"
import { useNativeApp, detectNativeAppClient } from "@/hooks/use-native-app"
import { appendNativeAppQuery } from "@/lib/mobile-native-app"
import { StudentTopbarV2 } from "@/components/student/dashboard-v2/Topbar"
import { StudentSidebarV2 } from "@/components/student/dashboard-v2/Sidebar"
import {
  DashboardChromeTitleProvider,
  DashboardChromeTitleSlots,
} from "@/components/dashboard-v2/DashboardChromeTitlePortal"
import { magnificShellClass, magnificShellCardClass, magnificMergedMainClass } from "@/lib/appearance/magnific-shell"
import { cn } from "@/lib/utils"
import { isCodebenchWorkspacePath } from "@/src/features/codebench/workspace-path"

const DashboardTour = dynamic(
  () =>
    import("@/components/student/dashboard-v2/DashboardTour").then((m) => ({
      default: m.DashboardTour,
    })),
  { ssr: false },
)
import { dashboardV2ShellMainClass, isStudentLectureViewerPath } from "@/lib/dashboard-v2-layout"
import { SUMMER_CAMP_DASHBOARD_BASE } from "@/lib/summer-camp/camper-nav"
import { isSummerProgramRole } from "@/lib/summer-camp/program-roles"
import { PlatformActivityTracker } from "@/components/platform-activity-tracker"
import { PresenceSelfProvider } from "@/components/presence/PresenceSelfProvider"
import { getRememberedStudentLoginPath } from "@/lib/remembered-auth"
import { hasStudentExplicitSignOut } from "@/lib/student-session-restore-client"
import { clearLeftoverClientSessions, clearAllClientSessionsIncludingRefresh } from "@/lib/session-restore-guard"
import { restoreStudentSessionWithRetry } from "@/lib/student-session-restore-retry"
import { syncAppearanceSetupFromServer } from "@/lib/appearance/appearance-setup"
import { Loader2 } from "lucide-react"

/** Close mobile drawer on route change; desktop rail stays as the user left it. */
function MobileSidebarCloseOnNavigate() {
  const pathname = usePathname()
  const { setMobileSidebarOpen } = useDashboardV2()
  useEffect(() => {
    setMobileSidebarOpen(false)
  }, [pathname, setMobileSidebarOpen])
  return null
}

/** Auto-collapse sidebar when CodeBench IDE is open to maximize space for editor + AI panel */
function CodebenchSidebarEffect() {
  const pathname = usePathname()
  const { setSidebarCollapsed } = useDashboardV2()
  const isCodebenchIde = isCodebenchWorkspacePath(pathname)

  useEffect(() => {
    if (!isCodebenchIde) return
    setSidebarCollapsed(true)
    return () => setSidebarCollapsed(false)
  }, [isCodebenchIde, setSidebarCollapsed])

  return null
}

/** Maximize slide area: collapse sidebar on lecture viewer routes */
function LectureViewerSidebarEffect() {
  const pathname = usePathname()
  const { setSidebarCollapsed } = useDashboardV2()
  const isLectureViewer = isStudentLectureViewerPath(pathname)

  useEffect(() => {
    if (!isLectureViewer) return
    setSidebarCollapsed(true)
    return () => setSidebarCollapsed(false)
  }, [isLectureViewer, setSidebarCollapsed])

  return null
}

function CoraImmersiveSidebarEffect() {
  const { coraImmersive, setSidebarCollapsed } = useDashboardV2()

  useEffect(() => {
    if (!coraImmersive) return
    setSidebarCollapsed(true)
    return () => setSidebarCollapsed(false)
  }, [coraImmersive, setSidebarCollapsed])

  return null
}

function DashboardContent({
  children,
  merged = false,
}: {
  children: React.ReactNode
  merged?: boolean
}) {
  const { coraImmersive } = useDashboardV2()
  const pathname = usePathname()
  /** IDE route only — hub (`/codebench`) keeps normal dashboard chrome */
  const isCodebenchIde = isCodebenchWorkspacePath(pathname)
  const isLectureViewer = isStudentLectureViewerPath(pathname)
  const isPracticeQuiz = Boolean(pathname?.includes("/practice/quiz"))
  const contentPadding =
    isCodebenchIde || isLectureViewer || coraImmersive
      ? "p-0"
      : merged
        ? magnificMergedMainClass
        : dashboardV2ShellMainClass
  const mainLayoutClass =
    isCodebenchIde || isLectureViewer || coraImmersive
      ? "flex-1 flex min-h-0 flex-col overflow-x-hidden overflow-y-hidden"
      : isPracticeQuiz
        ? "flex-1 min-h-0 min-w-0 overflow-x-hidden overflow-y-auto overscroll-contain"
        : merged
          ? "min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain"
          : "flex-1 min-h-0 min-w-0 overflow-x-hidden overflow-y-auto"
  return (
    <main
      data-tour="main-content"
      data-practice-quiz={isPracticeQuiz ? "true" : undefined}
      className={cn(mainLayoutClass, contentPadding)}
    >
      {!isCodebenchIde && !coraImmersive ? <DashboardChromeTitleSlots /> : null}
      {children}
    </main>
  )
}

function TourWrapper() {
  const { tourOpen, setTourOpen } = useDashboardV2()
  if (!tourOpen) return null
  return <DashboardTour open={tourOpen} onOpenChange={setTourOpen} />
}

function DashboardShellBody({ children }: { children: React.ReactNode }) {
  const { coraImmersive } = useDashboardV2()
  const pathname = usePathname()
  const isCodebenchIde = isCodebenchWorkspacePath(pathname)
  const isLectureViewer = isStudentLectureViewerPath(pathname)
  const useMergedCard = !coraImmersive && !isCodebenchIde && !isLectureViewer

  return (
    <DashboardChromeTitleProvider>
      <div
        className={cn(
          "flex min-h-0 flex-1 gap-3 overflow-hidden p-3 sm:gap-4 sm:p-4",
          magnificShellClass,
        )}
      >
        {!coraImmersive ? <StudentSidebarV2 /> : null}
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
              <StudentTopbarV2 merged />
              <DashboardContent merged>{children}</DashboardContent>
            </div>
          ) : (
            <>
              {!coraImmersive ? <StudentTopbarV2 /> : null}
              <DashboardContent>{children}</DashboardContent>
            </>
          )}
        </div>
      </div>
    </DashboardChromeTitleProvider>
  )
}

export default function DashboardV2Layout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const isNativeApp = useNativeApp()
  const [authReady, setAuthReady] = useState(false)
  const [sessionValid, setSessionValid] = useState(false)
  const studentInfoSyncedRef = useRef(false)
  const isNativeCodebenchIde =
    isCodebenchWorkspacePath(pathname) &&
    (typeof window !== "undefined" ? detectNativeAppClient() : isNativeApp)

  useEffect(() => {
    if (hasStudentExplicitSignOut()) {
      clearAllClientSessionsIncludingRefresh()
      setAuthReady(true)
      setSessionValid(false)
      return
    }
    void restoreStudentSessionWithRetry().finally(() => {
      setAuthReady(true)
      setSessionValid(getStudentData() != null)
    })
  }, [])

  useEffect(() => {
    const onSessionRestored = () => {
      setSessionValid(getStudentData() != null)
    }
    window.addEventListener("cc-session-restored", onSessionRestored)
    window.addEventListener("student-session-ready", onSessionRestored)
    return () => {
      window.removeEventListener("cc-session-restored", onSessionRestored)
      window.removeEventListener("student-session-ready", onSessionRestored)
    }
  }, [])

  useEffect(() => {
    if (!authReady) return

    void (async () => {
      let data = getStudentData()
      if (!data) {
        const restored = await restoreStudentSessionWithRetry({ maxAttempts: 2 })
        if (restored) data = getStudentData()
      }
      if (!data) {
        setSessionValid(false)
        const loginPath = pathname?.includes("/summer-camp")
          ? "/student/login/summer-camp"
          : wasSessionExpired()
            ? "/auth/student?reason=session_expired"
            : getRememberedStudentLoginPath()
        const native =
          isNativeApp ||
          (typeof window !== "undefined" &&
            (window.location.search.includes("native=1") ||
              document.documentElement.dataset.nativeApp === "true"))
        router.push(native ? appendNativeAppQuery(loginPath) : loginPath)
        return
      }
      setSessionValid(true)
      if (data.isPlatformGuest) {
        router.replace("/guest")
        return
      }
      if (data.isSummerCamper || isSummerProgramRole(data.studentProgramRole ?? "")) {
        const isCampRoute =
          pathname?.startsWith(SUMMER_CAMP_DASHBOARD_BASE) ||
          pathname === "/student/dashboard-v2/settings"
        if (!isCampRoute) {
          router.replace(SUMMER_CAMP_DASHBOARD_BASE)
        }
      }
    })()
  }, [authReady, router, pathname, isNativeApp])

  useEffect(() => {
    if (!authReady || studentInfoSyncedRef.current) return
    const data = getStudentData()
    if (!data || data.isPlatformGuest) return

    studentInfoSyncedRef.current = true
    let cancelled = false
    ;(async () => {
      try {
        const res = await studentApiFetch(`/api/student/info?student_id=${encodeURIComponent(data.id)}`)
        if (!res.ok || cancelled) return
        const info = await res.json()
        if (cancelled) return
        const dbSection = info.student?.section as string | undefined
        const dbCourseCode = info.student?.course_code as string | undefined
        if (dbSection) {
          patchStudentSessionSection(dbSection, dbCourseCode)
        }
        if (info.has_changed_password === false && !studentSessionReportsPasswordChanged()) {
          router.replace("/student/change-password?firstLogin=true")
          return
        }
        if (data.databaseId) {
          const appearanceSetupCompleted = await syncAppearanceSetupFromServer(data.databaseId)
          if (!appearanceSetupCompleted) {
            router.replace("/auth/theme")
          }
        }
      } catch {
        /* non-blocking; login flow should have redirected already */
      }
    })()

    return () => {
      cancelled = true
    }
  }, [authReady, router])

  useEffect(() => {
    setDashboardV2Preference(true)
  }, [])

  if (!authReady || !sessionValid) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-[var(--cc-background)] text-[var(--cc-text-muted)]">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--cc-accent)]" aria-label="Loading session" />
      </div>
    )
  }

  return (
    <DashboardV2Provider>
      <PresenceSelfProvider>
      <div
        className={`dashboard-v2-premium h-[100dvh] max-h-[100dvh] overflow-hidden flex flex-col antialiased ${
          isNativeCodebenchIde
            ? "bg-[#0c0f16] text-white"
            : "bg-[var(--cc-background)] text-[var(--cc-text)]"
        }`}
      >
        {/* Layer 1: PVAMU Purple & Gold atmospheric gradients (static — no blur filters) */}
        <div
          className="fixed inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(circle at 15% 15%, rgba(88,44,131,0.06), transparent 45%), radial-gradient(circle at 85% 85%, rgba(234,170,0,0.04), transparent 45%)",
          }}
        />

        <div className="dashboard-v2-shell relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden">
          <TourWrapper />
          <CodebenchSidebarEffect />
          <LectureViewerSidebarEffect />
          <CoraImmersiveSidebarEffect />
          <MobileSidebarCloseOnNavigate />
          <DashboardShellBody>{children}</DashboardShellBody>
          <PlatformActivityTracker />
        </div>
      </div>
      </PresenceSelfProvider>
    </DashboardV2Provider>
  )
}
