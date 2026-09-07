"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { getStudentData } from "@/lib/auth"
import { syncAppearanceSetupFromServer } from "@/lib/appearance/appearance-setup"
import { PresenceSelfProvider } from "@/components/presence/PresenceSelfProvider"
import { PlatformActivityTracker } from "@/components/platform-activity-tracker"
import { dashboardV2ShellMainClass } from "@/lib/dashboard-v2-layout"
import { cn } from "@/lib/utils"
import { GuestDashboardProvider, useGuestDashboard } from "@/components/guest/dashboard/GuestDashboardContext"
import { GuestTopbar } from "@/components/guest/dashboard/GuestTopbar"
import { GuestSidebar } from "@/components/guest/dashboard/GuestSidebar"
import { DesktopGuestLangSmithChrome } from "@/components/desktop/DesktopLangSmithChrome"
import { isDesktopAppShell } from "@/lib/desktop-auth-policy"
import { GuestBreadcrumbs } from "@/components/guest/dashboard/GuestBreadcrumbs"
import { guestHasCapability } from "@/lib/guest/capabilities"

function MobileSidebarCloseOnNavigate() {
  const pathname = usePathname()
  const { setMobileSidebarOpen } = useGuestDashboard()
  useEffect(() => {
    setMobileSidebarOpen(false)
  }, [pathname, setMobileSidebarOpen])
  return null
}

function CoraImmersiveSidebarEffect() {
  const pathname = usePathname()
  const { coraImmersive, setSidebarCollapsed } = useGuestDashboard()
  const onCora = pathname?.startsWith("/guest/cora-career") || pathname?.startsWith("/guest/career")

  useEffect(() => {
    if (!onCora || !coraImmersive) return
    setSidebarCollapsed(true)
  }, [onCora, coraImmersive, setSidebarCollapsed])

  return null
}

function GuestShellBody({ children }: { children: React.ReactNode }) {
  const { sidebarCollapsed, coraImmersive } = useGuestDashboard()
  const pathname = usePathname()
  const isCoraRoute = pathname?.startsWith("/guest/cora-career") || pathname?.startsWith("/guest/career")
  const immersive = coraImmersive && isCoraRoute
  const desktopChrome = isDesktopAppShell()

  if (desktopChrome) {
    return (
      <DesktopGuestLangSmithChrome>
        <main
          className={cn(
            "flex-1 min-h-0 min-w-0 overflow-x-hidden overflow-y-auto",
            immersive ? "p-0" : "p-2.5",
          )}
        >
          {children}
        </main>
      </DesktopGuestLangSmithChrome>
    )
  }

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden pt-16">
      {!immersive ? <GuestSidebar /> : null}
      <main
        className={cn(
          "flex-1 min-h-0 min-w-0 overflow-x-hidden overflow-y-auto transition-[margin-left] duration-300 ease-out",
          immersive ? "lg:ml-0 p-0" : sidebarCollapsed ? "lg:ml-20" : "lg:ml-72",
          !immersive && dashboardV2ShellMainClass,
        )}
      >
        {!immersive ? <GuestBreadcrumbs /> : null}
        {children}
      </main>
    </div>
  )
}

function GuestAuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { entitlements } = useGuestDashboard()

  useEffect(() => {
    const d = getStudentData()
    if (!d?.databaseId) {
      router.replace("/student/login/guest")
      return
    }
    if (!d.isPlatformGuest) {
      router.replace("/student/dashboard-v2")
      return
    }
    // Career members never hit a first-password-change screen — approval sets
    // has_changed_password = true and they pick their own password at
    // registration — so the theme prompt hangs off the portal shell instead.
    // Gating here rather than at login covers every way into /guest/*.
    let cancelled = false
    void (async () => {
      const completed = await syncAppearanceSetupFromServer(d.databaseId)
      if (!cancelled && !completed) router.replace("/auth/theme")
    })()
    return () => {
      cancelled = true
    }
  }, [router, pathname])

  useEffect(() => {
    if (entitlements.loading) return
    if (
      pathname?.startsWith("/guest/recommendations") &&
      entitlements.capabilities.length > 0 &&
      !guestHasCapability(entitlements.capabilities, "recommendations.request")
    ) {
      router.replace("/guest")
    }
  }, [pathname, entitlements, router])

  return <>{children}</>
}

export default function GuestShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <GuestDashboardProvider>
      <GuestAuthGate>
        <PresenceSelfProvider>
          <div
            data-guest-portal
            className="dashboard-v2-premium h-[100dvh] max-h-[100dvh] overflow-hidden flex flex-col antialiased bg-[var(--cc-background)] text-[var(--cc-text)]"
          >
            <div
              className="fixed inset-0 pointer-events-none"
              style={{
                background:
                  "radial-gradient(circle at 15% 15%, rgba(124,58,237,0.05), transparent 45%), radial-gradient(circle at 85% 85%, rgba(234,170,0,0.03), transparent 45%)",
              }}
            />
            <div className="dashboard-v2-shell relative z-10 flex flex-1 min-h-0 flex-col overflow-hidden">
              {isDesktopAppShell() ? null : <GuestTopbar />}
              <MobileSidebarCloseOnNavigate />
              <CoraImmersiveSidebarEffect />
              <GuestShellBody>{children}</GuestShellBody>
              <PlatformActivityTracker />
            </div>
          </div>
        </PresenceSelfProvider>
      </GuestAuthGate>
    </GuestDashboardProvider>
  )
}
