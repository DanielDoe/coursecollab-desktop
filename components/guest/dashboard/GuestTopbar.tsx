"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { CourseCollabLogo } from "@/components/course-collab-logo"
import { Button } from "@/components/ui/button"
import { DrawerNavIcon } from "@/components/student/dashboard-v2/DrawerNavIcon"
import { useTheme } from "@/hooks/use-theme"
import { useAppearance } from "@/components/appearance/AppearanceProvider"
import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler"
import { GuestHeaderProfileMenu } from "@/components/guest/GuestHeaderProfileMenu"
import { getStudentData } from "@/lib/auth"
import { CAREER_MEMBER_LABEL } from "@/lib/guest/display"
import { cn } from "@/lib/utils"
import { useGuestDashboard } from "./GuestDashboardContext"
import { GUEST_DASHBOARD_HREF } from "@/lib/guest/guest-nav"

function AppBarThemeToggle({
  theme,
  onThemeChange,
}: {
  theme: "light" | "dark"
  onThemeChange: (theme: "light" | "dark") => void
}) {
  const isLight = theme === "light"
  return (
    <AnimatedThemeToggler
      theme={theme}
      onThemeChange={onThemeChange}
      className="relative hidden h-9 w-[4.5rem] shrink-0 items-center rounded-full bg-[var(--muted)] p-1 sm:inline-flex"
      aria-label={isLight ? "Switch to dark mode" : "Switch to light mode"}
    >
      <DrawerNavIcon
        name="sunny-outline"
        size={16}
        color="var(--cc-text-muted)"
        className={cn("pointer-events-none absolute left-3 transition-opacity", isLight ? "opacity-0" : "opacity-100")}
      />
      <DrawerNavIcon
        name="moon-outline"
        size={16}
        color="var(--cc-text-muted)"
        className={cn("pointer-events-none absolute right-3 transition-opacity", isLight ? "opacity-100" : "opacity-0")}
      />
      <span
        className={cn(
          "relative z-10 flex size-7 items-center justify-center rounded-full bg-[var(--card)] text-[var(--cc-text)] shadow-sm transition-transform duration-200",
          isLight ? "translate-x-0" : "translate-x-[1.75rem]",
        )}
      >
        {isLight ? (
          <DrawerNavIcon name="sunny-outline" size={16} color="var(--cc-text)" />
        ) : (
          <DrawerNavIcon name="moon-outline" size={16} color="var(--cc-text)" />
        )}
      </span>
    </AnimatedThemeToggler>
  )
}

export function GuestTopbar() {
  const pathname = usePathname()
  const { theme } = useTheme()
  const { setAppearanceMode } = useAppearance()
  const {
    setMobileSidebarOpen,
    setSidebarCollapsed,
    sidebarCollapsed,
    coraImmersive,
    setCoraImmersive,
    entitlements,
  } = useGuestDashboard()
  const [session, setSession] = useState<ReturnType<typeof getStudentData>>(null)

  useEffect(() => {
    setSession(getStudentData())
  }, [pathname])

  return (
    <header
      data-dashboard-topbar
      data-guest-portal
      className="fixed inset-x-0 top-0 z-[60] h-16 overflow-visible border-b border-[var(--border)] bg-[var(--card)] shadow-[0_1px_2px_rgba(0,0,0,0.04)] lg:h-[3.25rem]"
    >
      <div className="flex h-full w-full items-center gap-3 px-3 sm:px-4 lg:px-6">
        <div className="flex items-center gap-1.5 sm:gap-3 min-w-0 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden shrink-0 rounded-xl size-9 sm:size-10 text-[var(--cc-text-secondary)] hover:text-[var(--cc-text)] hover:bg-[var(--sidebar-accent)]"
            onClick={() => {
              setSidebarCollapsed(false)
              setMobileSidebarOpen(true)
            }}
            aria-label="Open navigation menu"
          >
            <DrawerNavIcon name="menu-outline" size={20} color="var(--cc-text-secondary)" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="hidden lg:flex shrink-0 rounded-2xl size-11 text-[var(--cc-text-secondary)] hover:text-[var(--cc-text)] hover:bg-[var(--sidebar-accent)]"
            onClick={() => {
              if (coraImmersive) {
                setCoraImmersive(false)
                setSidebarCollapsed(false)
                return
              }
              setSidebarCollapsed(!sidebarCollapsed)
            }}
            aria-label={
              coraImmersive ? "Exit immersive workspace" : sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"
            }
          >
            {coraImmersive || sidebarCollapsed ? (
              <DrawerNavIcon name="panel-left-outline" size={20} color="var(--cc-text-secondary)" />
            ) : (
              <DrawerNavIcon name="panel-left-close-outline" size={20} color="var(--cc-text-secondary)" />
            )}
          </Button>
          <Link
            href={GUEST_DASHBOARD_HREF}
            className="flex items-center shrink-0 rounded-lg px-1 py-0.5 sm:rounded-xl sm:px-2 sm:py-1.5 hover:bg-[var(--sidebar-accent)] transition-all duration-300"
          >
            <CourseCollabLogo size="xs" tone="primary" frameClassName="rounded-lg" className="lg:hidden" withWordmark />
            <div className="hidden lg:flex items-center gap-2">
              <CourseCollabLogo size="sm" tone="primary" withWordmark />
              <span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-violet-700 dark:text-violet-300">
                {CAREER_MEMBER_LABEL}
              </span>
            </div>
          </Link>
        </div>

        <div className="flex-1 min-w-3" aria-hidden />

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {entitlements.credits != null ? (
            <Link
              href="/guest/cora-credits"
              className="hidden sm:inline-flex items-center rounded-full bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-700 dark:text-violet-300 hover:bg-violet-500/15"
            >
              {entitlements.credits.toLocaleString()} credits
            </Link>
          ) : null}
          <AppBarThemeToggle theme={theme} onThemeChange={setAppearanceMode} />
          <GuestHeaderProfileMenu name={session?.name} email={session?.email} />
        </div>
      </div>
    </header>
  )
}
