"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { useRouter, usePathname } from "next/navigation"
import { Crown, Star, Award, ArrowRight } from "lucide-react"
import { getStudentData, logoutStudent, studentApiFetch } from "@/lib/auth"
import { MEMBERSHIP_PLANS, type MembershipTier } from "@/lib/membership-constants"
import { useAppearance } from "@/components/appearance/AppearanceProvider"
import { AnimatedThemeToggler, runThemeReveal } from "@/components/ui/animated-theme-toggler"
import { DrawerNavIcon } from "./DrawerNavIcon"
import {
  ProfileAvatarWithPresence,
  ProfileDropdownPresenceBlock,
  ProfileRoleWithStatus,
} from "@/components/presence/HeaderProfilePresence"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useDashboardV2 } from "./DashboardV2Context"
import { Popover, PopoverContent, PopoverAnchor } from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { DASHBOARD_V2_MODULES } from "@/lib/dashboard-v2-nav"
import { SUMMER_CAMP_DASHBOARD_BASE } from "@/lib/summer-camp/camper-nav"
import { isSummerProgramRole } from "@/lib/summer-camp/program-roles"
import { cachedFetchJson } from "@/lib/student-client-cache"
import { cn } from "@/lib/utils"
import { COURSE_SWITCH_EVENT } from "@/lib/data/types"
import { useTheme } from "@/hooks/use-theme"
import { magnificShellCardClass, magnificMergedBreadcrumbsClass } from "@/lib/appearance/magnific-shell"
import { NotificationBell } from "@/components/notification-bell"
import { StudentCourseSwitcher } from "./StudentCourseSwitcher"
import { DashboardBreadcrumbs } from "./DashboardBreadcrumbs"
import { isCodebenchWorkspacePath } from "@/src/features/codebench/workspace-path"
import {
  isStudentLectureViewerPath,
  isStudentSummerCampModulePath,
} from "@/lib/dashboard-v2-layout"

/** CourseCollab web app header — course chip, module search, theme, notifications, profile */
export function StudentTopbarV2({ merged = false }: { merged?: boolean }) {
  const {
    setMobileSidebarOpen,
    setSidebarCollapsed,
    sidebarCollapsed,
    searchOpen,
    setSearchOpen,
    coraImmersive,
    setCoraImmersive,
  } = useDashboardV2()
  const closeSearchAndNavigate = (href: string) => {
    setSearchOpen(false)
    setSearchQuery("")
    setMobileSidebarOpen(false)
    router.push(href)
  }
  const router = useRouter()
  const pathname = usePathname()
  const { theme } = useTheme()
  const { setAppearanceMode } = useAppearance()
  const setResolvedTheme = (next: "light" | "dark") => setAppearanceMode(next)
  const [studentData, setStudentData] = useState<{ name: string | null; section: string | null }>({
    name: null,
    section: null,
  })
  const [membershipTier, setMembershipTier] = useState<MembershipTier | null>(null)
  const [profileOpen, setProfileOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [isSummerCamper, setIsSummerCamper] = useState(false)
  const isOnSummerCampRoute = Boolean(pathname?.startsWith(SUMMER_CAMP_DASHBOARD_BASE))
  const showSummerCampChrome = isSummerCamper || isOnSummerCampRoute
  const isCodebenchIde = isCodebenchWorkspacePath(pathname)
  const isLectureViewer = isStudentLectureViewerPath(pathname)
  const isSummerCampModule = isStudentSummerCampModulePath(pathname)
  const isPracticeQuiz = Boolean(pathname?.includes("/practice/quiz"))
  const showBreadcrumbs =
    !isCodebenchIde &&
    !coraImmersive &&
    !isLectureViewer &&
    !isSummerCampModule &&
    !isPracticeQuiz
  const dropdownRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const avatarInitials =
    (studentData.name || "Student")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0] ?? "")
      .join("")
      .toUpperCase() || "S"

  const filteredModules = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const modules = DASHBOARD_V2_MODULES
    if (!q) return modules
    return modules.filter(
      (m) => m.label.toLowerCase().includes(q) || m.group.toLowerCase().includes(q),
    )
  }, [searchQuery])

  const groupedModules = useMemo(() => {
    return filteredModules.reduce<Record<string, typeof filteredModules>>((acc, m) => {
      if (!acc[m.group]) acc[m.group] = []
      acc[m.group].push(m)
      return acc
    }, {})
  }, [filteredModules])

  useEffect(() => {
    const syncStudent = () => {
      const data = getStudentData()
      if (data) {
        setStudentData({ name: data.name, section: data.section })
      }
      const summerCamper =
        pathname?.includes("/summer-camp") ||
        data?.isSummerCamper === true ||
        isSummerProgramRole(data?.studentProgramRole ?? "") ||
        isSummerProgramRole(sessionStorage.getItem("studentProgramRole") ?? "")
      setIsSummerCamper(!!summerCamper)
    }
    syncStudent()
    window.addEventListener(COURSE_SWITCH_EVENT, syncStudent)
    window.addEventListener("student-session-ready", syncStudent)
    return () => {
      window.removeEventListener(COURSE_SWITCH_EVENT, syncStudent)
      window.removeEventListener("student-session-ready", syncStudent)
    }
  }, [pathname])

  useEffect(() => {
    const data = getStudentData()
    const dbId = sessionStorage.getItem("studentDatabaseId") ?? data?.databaseId ?? null
    if (!dbId) return

    void cachedFetchJson(
      `membership:${dbId}`,
      async () => {
        const res = await studentApiFetch(`/api/student/membership?studentId=${dbId}`)
        if (!res.ok) throw new Error("membership")
        return res.json()
      },
      300_000,
    )
      .then((j) => setMembershipTier((j?.membership?.tier ?? "Scholar") as MembershipTier))
      .catch(() => {})
  }, [])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setProfileOpen(false)
      }
    }
    if (profileOpen) document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [profileOpen])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (window.innerWidth < 768) return
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setSearchOpen(!searchOpen)
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [searchOpen, setSearchOpen])

  const handleLogout = () => {
    void logoutStudent()
  }

  return (
    <header
      data-dashboard-topbar
      className={cn("shrink-0", merged && "border-0 shadow-none")}
    >
      <Popover
        open={searchOpen}
        onOpenChange={(open) => {
          setSearchOpen(open)
          if (!open) setSearchQuery("")
        }}
      >
        <div
          className={cn(
            merged ? "shrink-0" : magnificShellCardClass,
            "relative px-3 py-2 sm:px-4",
            merged ? "sm:pt-2.5 sm:pb-0" : "sm:py-2.5",
          )}
        >
          <div className="relative flex h-11 w-full items-center gap-1.5 sm:gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="size-9 shrink-0 rounded-xl text-[var(--cc-text-muted)] hover:bg-[var(--muted)] hover:text-[var(--cc-text)] lg:hidden"
              onClick={() => {
                setSidebarCollapsed(false)
                setMobileSidebarOpen(true)
              }}
              aria-label="Open navigation menu"
            >
              <DrawerNavIcon name="menu-outline" size={20} color="currentColor" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="hidden size-9 shrink-0 rounded-xl text-[var(--cc-text-muted)] hover:bg-[var(--muted)] hover:text-[var(--cc-text)] lg:flex"
              onClick={() => {
                if (coraImmersive) {
                  setCoraImmersive(false)
                  setSidebarCollapsed(false)
                  return
                }
                setSidebarCollapsed(!sidebarCollapsed)
              }}
              aria-label={
                coraImmersive
                  ? "Exit immersive workspace"
                  : sidebarCollapsed
                    ? "Expand sidebar"
                    : "Collapse sidebar"
              }
              title={coraImmersive ? "Exit immersive workspace" : undefined}
            >
              {coraImmersive || sidebarCollapsed ? (
                <DrawerNavIcon name="panel-left-outline" size={18} color="currentColor" />
              ) : (
                <DrawerNavIcon name="panel-left-close-outline" size={18} color="currentColor" />
              )}
            </Button>

            {!showSummerCampChrome ? (
              <div className="hidden shrink-0 sm:block">
                <StudentCourseSwitcher />
              </div>
            ) : null}

            <PopoverAnchor asChild>
              <div className="absolute left-1/2 hidden w-[min(14rem,30vw)] -translate-x-1/2 md:block lg:w-[min(16rem,24vw)] xl:w-[min(28rem,42vw)]">
                <DrawerNavIcon
                  name="search-outline"
                  size={16}
                  color="var(--cc-text-muted)"
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
                />
                <Input
                  ref={searchInputRef}
                  placeholder="Search modules"
                  readOnly
                  aria-label="Search dashboard modules"
                  aria-expanded={searchOpen}
                  className="h-9 cursor-pointer rounded-xl border border-[var(--border)] bg-[var(--muted)]/50 pl-9 pr-14 text-sm text-[var(--cc-text)] shadow-none placeholder:text-[var(--cc-text-muted)] focus-visible:ring-1 focus-visible:ring-[var(--cc-accent)]/30"
                  onClick={() => setSearchOpen(true)}
                />
                <kbd className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded-md border border-[var(--border)] bg-[var(--card)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--cc-text-muted)] lg:inline">
                  ⌘K
                </kbd>
              </div>
            </PopoverAnchor>

            <div className="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-1.5">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSearchOpen(true)}
                className="size-9 rounded-xl text-[var(--cc-text-muted)] hover:bg-[var(--muted)] hover:text-[var(--cc-text)] md:hidden"
                aria-label="Search modules"
              >
                <DrawerNavIcon name="search-outline" size={18} color="currentColor" />
              </Button>

              <AnimatedThemeToggler
                theme={theme}
                onThemeChange={setResolvedTheme}
                className="relative hidden size-9 shrink-0 items-center justify-center rounded-xl text-[var(--cc-text-muted)] hover:bg-[var(--muted)] hover:text-[var(--cc-text)] md:inline-flex"
                aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
              >
                {theme === "light" ? (
                  <DrawerNavIcon name="moon-outline" size={18} color="currentColor" />
                ) : (
                  <DrawerNavIcon name="sunny-outline" size={18} color="currentColor" />
                )}
              </AnimatedThemeToggler>

              <NotificationBell variant="app-bar" />

              <div className="relative shrink-0" ref={dropdownRef} data-tour="profile">
                <Button
                  variant="ghost"
                  className="flex h-9 items-center gap-2 rounded-xl px-0 hover:bg-[var(--muted)] sm:px-1 sm:pr-2"
                  onClick={() => setProfileOpen(!profileOpen)}
                  aria-label="Open profile menu"
                >
                  <ProfileAvatarWithPresence>
                    <span
                      className="flex size-8 items-center justify-center rounded-full text-[11px] font-semibold tracking-wide"
                      style={{ backgroundColor: "var(--cc-accent)", color: "#FFFFFF" }}
                    >
                      {avatarInitials}
                    </span>
                  </ProfileAvatarWithPresence>
                  <span className="hidden max-w-[8rem] truncate text-sm font-medium text-[var(--cc-text)] lg:inline">
                    {studentData.name || "Student"}
                  </span>
                  <DrawerNavIcon
                    name="chevron-down"
                    size={14}
                    color="var(--cc-text-muted)"
                    className="hidden lg:block"
                  />
                </Button>

                {profileOpen && (
                  <div className="absolute right-0 top-full z-50 mt-2 w-[min(16rem,calc(100vw-1.5rem))] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--popover)] py-2 shadow-lg">
                    <div className="border-b border-[var(--border)] px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-[var(--cc-text)]">
                          {studentData.name || "Student"}
                        </p>
                        {!showSummerCampChrome && membershipTier && (() => {
                          const plan = MEMBERSHIP_PLANS.find((p) => p.id === membershipTier)
                          if (!plan) return null
                          const config =
                            membershipTier === "Trailblazer"
                              ? { icon: Crown, fill: "#7C3AED" }
                              : membershipTier === "Explorer"
                                ? { icon: Star, fill: "#06B6D4" }
                                : { icon: Award, fill: "#64748B" }
                          const Icon = config.icon
                          return (
                            <span
                              className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold text-white"
                              style={{ backgroundColor: config.fill }}
                              title={plan.displayName}
                            >
                              <Icon className="h-3 w-3" />
                              {plan.name}
                            </span>
                          )
                        })()}
                      </div>
                      <ProfileRoleWithStatus
                        role={
                          showSummerCampChrome
                            ? "Summer Camp Camper"
                            : `Section ${studentData.section || "—"}`
                        }
                      />
                    </div>
                    <ProfileDropdownPresenceBlock onSelect={() => setProfileOpen(false)} />
                    <div className="py-2">
                      {!showSummerCampChrome ? (
                        <button
                          onClick={() => {
                            setProfileOpen(false)
                            router.push("/auth/student/select-course")
                          }}
                          className="mx-2 flex w-[calc(100%-1rem)] items-center gap-3 rounded-lg px-4 py-2.5 text-sm text-[var(--cc-text-secondary)] hover:bg-[var(--sidebar-accent)]"
                        >
                          <DrawerNavIcon name="book-outline" size={16} color="currentColor" />
                          Switch course
                        </button>
                      ) : null}
                      <button
                        onClick={(e) => {
                          const next = theme === "dark" ? "light" : "dark"
                          runThemeReveal({
                            origin: e.currentTarget.getBoundingClientRect(),
                            nextTheme: next,
                            applyTheme: () => {
                              document.documentElement.classList.toggle("dark", next === "dark")
                              setResolvedTheme(next)
                            },
                          })
                          setProfileOpen(false)
                        }}
                        className="mx-2 flex w-[calc(100%-1rem)] items-center gap-3 rounded-lg px-4 py-2.5 text-sm text-[var(--cc-text-secondary)] hover:bg-[var(--sidebar-accent)] md:hidden"
                      >
                        {theme === "light" ? (
                          <DrawerNavIcon name="moon-outline" size={16} color="currentColor" />
                        ) : (
                          <DrawerNavIcon name="sunny-outline" size={16} color="currentColor" />
                        )}
                        {theme === "light" ? "Dark mode" : "Light mode"}
                      </button>
                      <button
                        onClick={() => {
                          setProfileOpen(false)
                          router.push("/student/dashboard-v2/settings")
                        }}
                        className="mx-2 flex w-[calc(100%-1rem)] items-center gap-3 rounded-lg px-4 py-2.5 text-sm text-[var(--cc-text-secondary)] hover:bg-[var(--sidebar-accent)]"
                      >
                        <DrawerNavIcon name="person-outline" size={16} color="currentColor" />
                        Edit Profile
                      </button>
                      {!showSummerCampChrome && (
                        <button
                          onClick={() => {
                            setProfileOpen(false)
                            router.push("/student/dashboard-v2/membership")
                          }}
                          className="mx-2 flex w-[calc(100%-1rem)] items-center gap-3 rounded-lg px-4 py-2.5 text-sm text-[var(--cc-text-secondary)] hover:bg-[var(--sidebar-accent)]"
                        >
                          <DrawerNavIcon name="diamond-outline" size={16} color="#f59e0b" />
                          Membership & plans
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setProfileOpen(false)
                          router.push("/student/dashboard-v2/settings/appearance")
                        }}
                        className="mx-2 flex w-[calc(100%-1rem)] items-center gap-3 rounded-lg px-4 py-2.5 text-sm text-[var(--cc-text-secondary)] hover:bg-[var(--sidebar-accent)]"
                      >
                        <DrawerNavIcon name="color-palette-outline" size={16} color="currentColor" />
                        Appearance & themes
                      </button>
                      <button
                        onClick={() => {
                          setProfileOpen(false)
                          router.push("/student/dashboard-v2/settings")
                        }}
                        className="mx-2 flex w-[calc(100%-1rem)] items-center gap-3 rounded-lg px-4 py-2.5 text-sm text-[var(--cc-text-secondary)] hover:bg-[var(--sidebar-accent)]"
                      >
                        <DrawerNavIcon name="settings-outline" size={16} color="currentColor" />
                        Settings
                      </button>
                    </div>
                    <div className="border-t border-[var(--border)] py-2">
                      <button
                        onClick={handleLogout}
                        className="mx-2 flex w-[calc(100%-1rem)] items-center gap-3 rounded-lg px-4 py-2.5 text-sm text-red-600 hover:bg-red-500/10 dark:text-red-400"
                      >
                        <DrawerNavIcon name="exit-outline" size={16} color="currentColor" />
                        Logout
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {showBreadcrumbs ? (
            <div className={magnificMergedBreadcrumbsClass} data-dashboard-breadcrumbs>
              <DashboardBreadcrumbs variant="embedded" />
            </div>
          ) : null}
        </div>

        <PopoverContent
          className="w-[min(100vw-2rem,28rem)] overflow-hidden rounded-xl p-0 shadow-lg md:w-[var(--radix-popover-trigger-width)]"
          align="center"
          sideOffset={6}
          onOpenAutoFocus={(e) => {
            if (window.innerWidth >= 1024) e.preventDefault()
          }}
        >
          <Command shouldFilter={false}>
            <div className="lg:hidden">
              <CommandInput
                placeholder="Search modules..."
                autoFocus
                value={searchQuery}
                onValueChange={setSearchQuery}
              />
            </div>
            <CommandList className="max-h-[min(320px,70vh)]">
              {filteredModules.length === 0 ? (
                <CommandEmpty className="py-6 text-center text-sm text-[var(--cc-text-muted)]">
                  No module found.
                </CommandEmpty>
              ) : (
                Object.entries(groupedModules).map(([group, items], index) => (
                  <CommandGroup key={`${group}-${index}`} heading={group}>
                    {items.map((m) => (
                      <CommandItem
                        key={m.id}
                        value={`${m.label} ${m.group}`}
                        onSelect={() => closeSearchAndNavigate(m.href)}
                        className="flex cursor-pointer items-center gap-2"
                      >
                        <span className="flex-1">{m.label}</span>
                        <ArrowRight className="h-4 w-4 text-[var(--cc-text-muted)]" />
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ))
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </header>
  )
}
