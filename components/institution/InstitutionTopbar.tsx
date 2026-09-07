"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { LogOut, Settings } from "lucide-react"
import { CourseCollabLogo } from "@/components/course-collab-logo"
import { Button } from "@/components/ui/button"
import { DrawerNavIcon } from "@/components/student/dashboard-v2/DrawerNavIcon"
import { useTheme } from "@/hooks/use-theme"
import { useAppearance } from "@/components/appearance/AppearanceProvider"
import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { initialsFromName } from "@/lib/initials-from-name"
import { INSTITUTION_DASHBOARD_BASE, INSTITUTION_PORTAL_MARK } from "@/lib/institution-portal-nav-config"
import { useInstitutionDashboard } from "./InstitutionDashboardContext"

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

function InstitutionProfileMenu({ name, role }: { name: string; role: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [open])

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" }).catch(() => null)
    router.push("/institution/login")
  }

  return (
    <div className="relative" ref={ref}>
      <Button
        type="button"
        variant="ghost"
        className="h-10 gap-2 rounded-full px-1.5 hover:bg-[var(--sidebar-accent)]"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Institution account menu"
      >
        <Avatar className="size-8">
          <AvatarFallback className="bg-[var(--cc-accent-soft)] text-xs font-semibold text-[var(--cc-accent)]">
            {initialsFromName(name)}
          </AvatarFallback>
        </Avatar>
        <span className="hidden max-w-[9rem] truncate text-left text-xs font-medium text-[var(--cc-text)] sm:block">
          {name}
        </span>
      </Button>
      {open ? (
        <div className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-56 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-2 shadow-lg">
          <p className="truncate px-2 py-1.5 text-sm font-semibold text-[var(--cc-text)]">{name}</p>
          <p className="truncate px-2 pb-2 text-xs capitalize text-[var(--cc-text-muted)]">{role || "Institution admin"}</p>
          <Link
            href={`${INSTITUTION_DASHBOARD_BASE}/settings`}
            className="flex items-center gap-2 rounded-xl px-2 py-2 text-sm text-[var(--cc-text-secondary)] hover:bg-muted/40"
            onClick={() => setOpen(false)}
          >
            <Settings className="h-4 w-4" />
            Settings
          </Link>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-sm text-[var(--cc-text-secondary)] hover:bg-muted/40"
            onClick={() => void signOut()}
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  )
}

export function InstitutionTopbar() {
  const { theme } = useTheme()
  const { setAppearanceMode } = useAppearance()
  const { setMobileSidebarOpen, setSidebarCollapsed, sidebarCollapsed, institutionName, role } =
    useInstitutionDashboard()

  return (
    <header
      data-dashboard-topbar
      className="fixed inset-x-0 top-0 z-[60] h-16 overflow-visible border-b border-[var(--border)] bg-[var(--card)] shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
    >
      <div className="flex h-full w-full items-center gap-3 px-3 sm:px-4 lg:px-6">
        <div className="flex min-w-0 shrink-0 items-center gap-1.5 sm:gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="size-9 shrink-0 rounded-xl text-[var(--cc-text-secondary)] hover:bg-[var(--sidebar-accent)] hover:text-[var(--cc-text)] sm:size-10 lg:hidden"
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
            className="hidden size-11 shrink-0 rounded-2xl text-[var(--cc-text-secondary)] hover:bg-[var(--sidebar-accent)] hover:text-[var(--cc-text)] lg:flex"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? (
              <DrawerNavIcon name="panel-left-outline" size={20} color="var(--cc-text-secondary)" />
            ) : (
              <DrawerNavIcon name="panel-left-close-outline" size={20} color="var(--cc-text-secondary)" />
            )}
          </Button>
          <Link
            href={INSTITUTION_DASHBOARD_BASE}
            className="flex items-center rounded-lg px-1 py-0.5 transition-all duration-300 hover:bg-[var(--sidebar-accent)] sm:rounded-xl sm:px-2 sm:py-1.5"
          >
            <CourseCollabLogo size="xs" tone="primary" frameClassName="rounded-lg" className="lg:hidden" withWordmark />
            <div className="hidden items-center gap-2 lg:flex">
              <CourseCollabLogo size="sm" tone="primary" withWordmark />
              <span className="rounded-full bg-[var(--cc-accent-soft)] px-2 py-0.5 text-[10px] font-semibold tracking-wide text-[var(--cc-accent)]">
                {INSTITUTION_PORTAL_MARK.label}
              </span>
            </div>
          </Link>
        </div>
        <div className="min-w-3 flex-1" aria-hidden />
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <AppBarThemeToggle theme={theme} onThemeChange={setAppearanceMode} />
          <InstitutionProfileMenu name={institutionName} role={role} />
        </div>
      </div>
    </header>
  )
}
