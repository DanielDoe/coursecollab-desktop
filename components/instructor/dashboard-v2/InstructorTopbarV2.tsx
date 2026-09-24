"use client"

import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { useTheme } from "@/hooks/use-theme"
import { useAppearance } from "@/components/appearance/AppearanceProvider"
import { AnimatedThemeToggler, runThemeReveal } from "@/components/ui/animated-theme-toggler"
import {
  persistRememberedFacultyAuth,
  readRememberedFacultyLogin,
  readRememberedFacultyUniversity,
} from "@/lib/remembered-auth"
import { CourseCollabLogo } from "@/components/course-collab-logo"
import {
  ProfileAvatarWithPresence,
  ProfileDropdownPresenceBlock,
  ProfileRoleWithStatus,
} from "@/components/presence/HeaderProfilePresence"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useInstructorDashboardV2 } from "./InstructorDashboardV2Context"
import { setInstructorDashboardVersion } from "@/lib/instructor-dashboard-version"
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { InstructorNotificationBell } from "@/components/instructor-notification-bell"
import { AdminNotificationBell } from "@/components/admin-notification-bell"
import { getPortalConfig } from "@/lib/portal-config"
import { staffRoleLabel } from "@/lib/faculty-portal-nav-config"
import { buildInstructorApiHeaders } from "@/lib/instructor-api-headers"
import { reconcileFacultySelectedCourse, facultyCourseSelectValue, parseFacultyOfferingKey, resolveFacultyCourseSelectValue } from "@/lib/faculty-course-session-sync"
import { isDesktopAppShell } from "@/lib/desktop-auth-policy"
import { findOfferingByKey } from "@/lib/faculty-auth-flow"
import { facultyOfferingChipCode } from "@/lib/faculty-course-offerings-shared"
import type { FacultyCourseOffering } from "@/lib/faculty-course-offerings-shared"
import { FacultyCourseOfferingSelectItems } from "@/components/faculty-course-offering-select-items"
import { logoutAdmin, getAdminData, getInstructorData } from "@/lib/auth"
import { logoutFaculty } from "@/lib/faculty-auth-flow"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select"
import { DrawerNavIcon } from "@/components/student/dashboard-v2/DrawerNavIcon"
import { InstructorDashboardBreadcrumbs } from "@/components/instructor/dashboard-v2/InstructorDashboardBreadcrumbs"
import { magnificShellCardClass, magnificMergedBreadcrumbsClass } from "@/lib/appearance/magnific-shell"
import { cn } from "@/lib/utils"

function profileInitials(name?: string | null, username?: string | null, fallback = "FC") {
  const source = (name?.trim() || username?.trim() || "").trim()
  if (!source) return fallback
  const parts = source.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase()
  }
  return source.slice(0, 2).toUpperCase()
}

function profileDisplayName(name?: string | null, username?: string | null, fallback = "Faculty") {
  return name?.trim() || username?.trim() || fallback
}

const FACULTY_COURSE_SCOPE_FIELDS = [
  "selectedCourseId",
  "selectedCourseCode",
  "selectedCourseTitle",
  "selectedCatalogCourseCode",
  "selectedSessionId",
  "selectedSessionCode",
  "selectedAcademicTermId",
  "selectedTermLabel",
  "staffRoleForCourse",
  "coursePermissions",
] as const

function readStoredFacultyCourseSelectValue(
  storageKey: string,
  isAdmin: boolean,
  allCoursesValue: string,
): string {
  if (typeof window === "undefined") return ""
  try {
    const session = JSON.parse(localStorage.getItem(storageKey) || "{}") as Record<string, unknown>
    if (isAdmin) {
      return session.selectedCourseId != null ? String(session.selectedCourseId) : allCoursesValue
    }
    return facultyCourseSelectValue(session)
  } catch {
    return ""
  }
}

function rememberFacultyCourseScope(session: Record<string, unknown>): Record<string, unknown> | null {
  if (session.selectedCourseId == null || String(session.selectedCourseId).trim() === "") return null
  const kept: Record<string, unknown> = {}
  for (const field of FACULTY_COURSE_SCOPE_FIELDS) {
    if (session[field] !== undefined) kept[field] = session[field]
  }
  return kept
}

/** A live-classroom teardown must not blank the header. Put the last course back. */
function restoreDroppedFacultyCourseScope(
  storageKey: string,
  kept: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (!kept) return kept
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return kept
    const session = JSON.parse(raw) as Record<string, unknown>
    if (session.courseScopeSkipped === true) return null
    if (session.selectedCourseId != null && String(session.selectedCourseId).trim() !== "") {
      return rememberFacultyCourseScope(session)
    }
    localStorage.setItem(storageKey, JSON.stringify({ ...session, ...kept }))
    return kept
  } catch {
    return kept
  }
}

export function InstructorTopbarV2({ merged = false }: { merged?: boolean }) {
  const {
    portal,
    staffRoleForCourse,
    basePath,
    loginPath,
    dashboardLink,
    navGroups,
    setMobileSidebarOpen,
    sidebarCollapsed,
    setSidebarCollapsed,
    beginCourseSwitch,
    bumpCourseScope,
    refreshPermissions,
    coraImmersive,
    setCoraImmersive,
    searchOpen,
    setSearchOpen,
  } = useInstructorDashboardV2()
  const portalCfg = getPortalConfig(portal)
  const isAdmin = portal === "admin"
  const router = useRouter()
  const { theme } = useTheme()
  const { setAppearanceMode } = useAppearance()
  const setResolvedTheme = (next: "light" | "dark") => setAppearanceMode(next)
  const [searchQuery, setSearchQuery] = useState("")
  const searchInputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [profileOpen, setProfileOpen] = useState(false)
  const [profileName, setProfileName] = useState<string | null>(null)
  const [profileUsername, setProfileUsername] = useState<string | null>(null)
  const [courses, setCourses] = useState<FacultyCourseOffering[]>([])
  const [activeTermLabel, setActiveTermLabel] = useState<string | null>(null)
  const ADMIN_ALL_COURSES = "__all__"
  const [courseSelectValue, setCourseSelectValue] = useState(() =>
    readStoredFacultyCourseSelectValue(portalCfg.sessionStorageKey, isAdmin, ADMIN_ALL_COURSES),
  )
  const keptCourseScopeRef = useRef<Record<string, unknown> | null>(null)

  const loadProfile = () => {
    if (isAdmin) {
      const data = getAdminData()
      setProfileName(data?.name ?? null)
      setProfileUsername(data?.username ?? null)
      return
    }
    const data = getInstructorData()
    setProfileName(data?.name ?? null)
    setProfileUsername(data?.username ?? null)
  }

  useEffect(() => {
    loadProfile()
    window.addEventListener("instructor-session-updated", loadProfile)
    return () => window.removeEventListener("instructor-session-updated", loadProfile)
  }, [isAdmin])

  const syncSelectFromSession = useCallback(() => {
    try {
      const s = JSON.parse(localStorage.getItem(portalCfg.sessionStorageKey) || "{}") as Record<string, unknown>
      const kept = rememberFacultyCourseScope(s)
      if (kept) keptCourseScopeRef.current = kept
      if (isAdmin) {
        setCourseSelectValue(
          s.selectedCourseId != null ? String(s.selectedCourseId) : ADMIN_ALL_COURSES,
        )
        return
      }
      const key = facultyCourseSelectValue(s)
      if (key) setCourseSelectValue(key)
    } catch {
      /* ignore */
    }
  }, [isAdmin, portalCfg.sessionStorageKey])

  const reloadCourses = useCallback(
    (opts?: { reconcile?: boolean }) => {
      const actorId = localStorage.getItem(portalCfg.idStorageKey)
      syncSelectFromSession()
      if (!actorId) return
      void fetch(`${portalCfg.apiPrefix}/courses`, { headers: { [portalCfg.idHeader]: actorId } })
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => {
          if (!j?.courses && !j?.offerings) return
          const list = (j.offerings ?? j.courses) as FacultyCourseOffering[]
          setCourses((current) => (list.length === 0 && current.length > 0 ? current : list))
          setActiveTermLabel(j.activeTerm?.label ?? null)
          if (!isAdmin && list.length > 0) {
            try {
              const raw = localStorage.getItem(portalCfg.sessionStorageKey)
              if (raw) {
                const session = JSON.parse(raw) as Record<string, unknown>
                const key = resolveFacultyCourseSelectValue(session, list)
                if (key) setCourseSelectValue(key)
              }
            } catch {
              /* ignore */
            }
          }
          if (isAdmin || !opts?.reconcile) return
          try {
            const raw = localStorage.getItem(portalCfg.sessionStorageKey)
            if (!raw) return
            const session = JSON.parse(raw) as Record<string, unknown>
            const { session: next, changed, valid } = reconcileFacultySelectedCourse(session, list)
            if (changed) {
              localStorage.setItem(portalCfg.sessionStorageKey, JSON.stringify(next))
              window.dispatchEvent(new Event("instructor-session-updated"))
              if (next.selectedCourseId != null) {
                setCourseSelectValue(facultyCourseSelectValue(next))
              }
              bumpCourseScope()
            }
            if (!valid) {
              router.replace("/faculty/select-course")
            }
          } catch {
            /* ignore */
          }
        })
        .catch(() => {})
    },
    [
      portalCfg.apiPrefix,
      portalCfg.idHeader,
      portalCfg.idStorageKey,
      portalCfg.sessionStorageKey,
      isAdmin,
      router,
      bumpCourseScope,
      syncSelectFromSession,
    ],
  )

  useEffect(() => {
    reloadCourses({ reconcile: true })
    const onRefresh = () => {
      keptCourseScopeRef.current = restoreDroppedFacultyCourseScope(
        portalCfg.sessionStorageKey,
        keptCourseScopeRef.current,
      )
      syncSelectFromSession()
      reloadCourses({ reconcile: false })
    }
    const onDisplaySync = () => {
      keptCourseScopeRef.current = restoreDroppedFacultyCourseScope(
        portalCfg.sessionStorageKey,
        keptCourseScopeRef.current,
      )
      syncSelectFromSession()
    }
    window.addEventListener("instructor-session-updated", onRefresh)
    window.addEventListener(portalCfg.courseScopeEvent, onRefresh)
    window.addEventListener("instructor-course-display-sync", onDisplaySync)
    return () => {
      window.removeEventListener("instructor-session-updated", onRefresh)
      window.removeEventListener(portalCfg.courseScopeEvent, onRefresh)
      window.removeEventListener("instructor-course-display-sync", onDisplaySync)
    }
  }, [reloadCourses, portalCfg.courseScopeEvent, portalCfg.sessionStorageKey, syncSelectFromSession])

  const displayName = profileDisplayName(
    profileName,
    profileUsername,
    isAdmin ? "Admin" : "Faculty",
  )
  const profileSubtitle = isAdmin
    ? "Administrator"
    : staffRoleForCourse
      ? staffRoleLabel(staffRoleForCourse)
      : portalCfg.portalLabel
  const avatarInitials = profileInitials(
    profileName,
    profileUsername,
    isAdmin ? "AD" : "FC",
  )

  const onCourseChange = (val: string) => {
    try {
      const raw = localStorage.getItem(portalCfg.sessionStorageKey)
      if (!raw) return
      const s = JSON.parse(raw)

      if (isAdmin && val === ADMIN_ALL_COURSES) {
        delete s.selectedCourseId
        delete s.selectedCourseCode
        delete s.selectedCourseTitle
        localStorage.setItem(portalCfg.sessionStorageKey, JSON.stringify(s))
        setCourseSelectValue(ADMIN_ALL_COURSES)
        bumpCourseScope()
        window.dispatchEvent(new Event("instructor-session-updated"))
        if (!isDesktopAppShell()) router.refresh()
        return
      }

      const { courseId, academicTermId, sessionId } = parseFacultyOfferingKey(val)
      const c = courses.find(
        (x) =>
          x.course_id === courseId &&
          (x.academic_term_id ?? null) === academicTermId &&
          (sessionId != null ? x.session_id === sessionId : x.session_id == null),
      )
      if (!c) return
      delete s.courseScopeSkipped
      s.selectedCourseId = c.course_id
      s.selectedCourseCode = c.catalog_course_code ?? c.course_code
      s.selectedCatalogCourseCode = c.catalog_course_code ?? c.course_code
      s.selectedCourseTitle = c.course_title
      if (c.session_id != null) {
        s.selectedSessionId = c.session_id
        s.selectedSessionCode = c.session_code ?? c.course_code
      } else {
        delete s.selectedSessionId
        delete s.selectedSessionCode
      }
      s.staffRoleForCourse = c.staff_role ?? s.staffRoleForCourse
      if (c.academic_term_id != null) {
        s.selectedAcademicTermId = c.academic_term_id
        s.selectedTermLabel = c.term_label
      } else {
        delete s.selectedAcademicTermId
        delete s.selectedTermLabel
      }
      localStorage.setItem(portalCfg.sessionStorageKey, JSON.stringify(s))
      const rememberedLogin = readRememberedFacultyLogin()
      const rememberedUniversity = readRememberedFacultyUniversity()
      if (rememberedLogin?.rememberMe && rememberedUniversity) {
        persistRememberedFacultyAuth({
          university: rememberedUniversity,
          username: rememberedLogin.username,
          rememberMe: true,
          courseKey: val,
        })
      }
      setCourseSelectValue(val)
      beginCourseSwitch({
        title: c.course_title,
        code: facultyOfferingChipCode(c),
      })
      void (async () => {
        try {
          const res = await fetch("/api/faculty/permissions", {
            headers: { ...buildInstructorApiHeaders(), "x-course-id": String(c.course_id) },
          })
          const json = await res.json()
          if (res.ok) {
            const raw2 = localStorage.getItem(portalCfg.sessionStorageKey)
            if (raw2) {
              const s2 = JSON.parse(raw2)
              s2.coursePermissions = json.permissions ?? []
              s2.staffRoleForCourse = json.staffRole ?? s2.staffRoleForCourse
              localStorage.setItem(portalCfg.sessionStorageKey, JSON.stringify(s2))
            }
            await refreshPermissions()
          }
        } catch {
          /* ignore */
        }
        window.dispatchEvent(new Event("instructor-session-updated"))
        if (!isDesktopAppShell()) router.refresh()
      })()
    } catch {
      /* ignore */
    }
  }

  const closeSearchAndNavigate = (href: string) => {
    setSearchOpen(false)
    setSearchQuery("")
    setMobileSidebarOpen(false)
    router.push(href)
  }

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
        setSearchOpen(true)
        requestAnimationFrame(() => searchInputRef.current?.focus())
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [])

  const handleLogout = () => {
    if (isAdmin) {
      logoutAdmin()
      return
    }
    logoutFaculty()
  }

  const allSearchModules = useMemo(
    () => [
      {
        id: dashboardLink.id,
        label: dashboardLink.label,
        href: dashboardLink.href,
        group: "Main",
      },
      ...navGroups.flatMap((group) =>
        group.items.map((item) => ({
          id: item.id,
          label: item.label,
          href: item.href,
          group: group.title,
        })),
      ),
    ],
    [dashboardLink, navGroups],
  )

  const filteredModules = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return allSearchModules
    return allSearchModules.filter(
      (m) => m.label.toLowerCase().includes(q) || m.group.toLowerCase().includes(q),
    )
  }, [allSearchModules, searchQuery])

  const groupedModules = useMemo(() => {
    return filteredModules.reduce<Record<string, typeof filteredModules>>((acc, m) => {
      if (!acc[m.group]) acc[m.group] = []
      acc[m.group].push(m)
      return acc
    }, {})
  }, [filteredModules])

  const selectedOffering = useMemo(() => {
    if (!courseSelectValue || (isAdmin && courseSelectValue === ADMIN_ALL_COURSES)) return null
    if (isAdmin) {
      return courses.find((c) => String(c.course_id ?? c.id) === courseSelectValue) ?? null
    }
    return findOfferingByKey(courses, courseSelectValue) ?? null
  }, [courseSelectValue, courses, isAdmin])

  const storedCourseLabel = useMemo(() => {
    if (isAdmin || typeof window === "undefined") return null
    try {
      const session = JSON.parse(localStorage.getItem(portalCfg.sessionStorageKey) || "{}") as {
        selectedSessionCode?: string
        selectedCourseCode?: string
      }
      return session.selectedSessionCode?.trim() || session.selectedCourseCode?.trim() || null
    } catch {
      return null
    }
  }, [courseSelectValue, isAdmin, portalCfg.sessionStorageKey])

  const courseChipPrimary =
    isAdmin && (!selectedOffering || courseSelectValue === ADMIN_ALL_COURSES)
      ? "All courses"
      : selectedOffering
        ? facultyOfferingChipCode(selectedOffering)
        : storedCourseLabel || "Course"
  const courseChipSecondary = selectedOffering
    ? [selectedOffering.course_title, selectedOffering.term_label ?? selectedOffering.semester]
        .filter(Boolean)
        .join(" · ")
    : isAdmin
      ? courses.length
        ? "Every assigned course"
        : "No courses"
      : courses.length
        ? "Select a course"
        : "No courses"

  return (
    <header data-dashboard-topbar className={cn("shrink-0", merged && "border-0 shadow-none")}>
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
                coraImmersive ? "Exit immersive workspace" : sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"
              }
              title={coraImmersive ? "Exit immersive workspace" : undefined}
            >
              {coraImmersive || sidebarCollapsed ? (
                <DrawerNavIcon name="panel-left-outline" size={18} color="currentColor" />
              ) : (
                <DrawerNavIcon name="panel-left-close-outline" size={18} color="currentColor" />
              )}
            </Button>
            <Link
              href={basePath}
              className={cn(
                "hidden shrink-0 items-center rounded-lg px-1 py-0.5 hover:bg-[var(--muted)] lg:flex xl:px-1.5",
                merged && "lg:hidden",
              )}
            >
              <CourseCollabLogo
                size="xs"
                tone="primary"
                frameClassName="rounded-lg"
                className="xl:hidden"
              />
              <CourseCollabLogo size="sm" tone="primary" className="hidden xl:inline-flex" withWordmark />
            </Link>
            <Select
              value={courseSelectValue || (isAdmin ? ADMIN_ALL_COURSES : undefined)}
              onValueChange={onCourseChange}
              disabled={courses.length === 0 && !isAdmin}
            >
              <SelectTrigger
                aria-label="Switch course"
                className={cn(
                  "h-9 min-w-0 max-w-[8.75rem] flex-1 gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--card)] px-2 shadow-none",
                  "sm:max-w-none sm:flex-none sm:w-[8.5rem] sm:gap-2 sm:px-2.5 md:w-[9rem] lg:w-[10rem] xl:w-[12.5rem]",
                  "text-slate-900 focus:ring-1 focus:ring-[var(--cc-accent)]/30 dark:text-white",
                )}
                title={courseChipSecondary}
              >
                <DrawerNavIcon
                  name="book-outline"
                  size={15}
                  color="var(--cc-accent-dark)"
                  className="hidden shrink-0 min-[380px]:block"
                />
                <span className="min-w-0 flex-1 truncate text-left text-[13px] font-semibold text-slate-900 dark:text-white">
                  {courseChipPrimary}
                </span>
              </SelectTrigger>
              <SelectContent className="max-h-[min(360px,60vh)] rounded-xl bg-[var(--popover)] text-[var(--cc-text)]">
                {isAdmin && (
                  <SelectItem value={ADMIN_ALL_COURSES} className="rounded-lg font-medium">
                    All courses
                  </SelectItem>
                )}
                {isAdmin ? (
                  courses.map((c) => {
                    const id = c.course_id ?? c.id
                    return (
                      <SelectItem key={id} value={String(id)} className="rounded-lg">
                        <span className="font-medium text-slate-900 dark:text-white">{c.course_title}</span>
                        <span className="ml-2 text-xs text-slate-600 dark:text-slate-400">
                          {c.course_code}
                          {(c.term_label ?? c.semester) ? ` · ${c.term_label ?? c.semester}` : ""}
                        </span>
                      </SelectItem>
                    )
                  })
                ) : (
                  <FacultyCourseOfferingSelectItems
                    offerings={courses}
                    activeTermLabel={activeTermLabel}
                  />
                )}
              </SelectContent>
            </Select>

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
                aria-controls="faculty-module-search-results"
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

            {isAdmin ? <AdminNotificationBell variant="app-bar" /> : <InstructorNotificationBell variant="app-bar" />}

            <div className="relative shrink-0" ref={dropdownRef}>
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
                  {displayName}
                </span>
                <DrawerNavIcon
                  name="chevron-down"
                  size={14}
                  color="var(--cc-text-muted)"
                  className="hidden lg:block"
                />
              </Button>

              {profileOpen && (
                <div className="absolute right-0 top-full z-50 mt-2 w-[min(16rem,calc(100vw-1.5rem))] rounded-2xl bg-[var(--popover)]/95 backdrop-blur-2xl border border-[var(--border)] shadow-xl py-2 overflow-hidden">
                  <div className="px-4 py-3 border-b border-[var(--border)]">
                    <p className="font-semibold text-[var(--cc-text)] truncate">{displayName}</p>
                    <ProfileRoleWithStatus role={profileSubtitle} />
                  </div>
                  <ProfileDropdownPresenceBlock onSelect={() => setProfileOpen(false)} />
                  <div className="py-2">
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
                      className="w-full flex md:hidden items-center gap-3 px-4 py-2.5 text-sm text-[var(--cc-text-secondary)] hover:bg-[var(--sidebar-accent)] transition-colors rounded-xl mx-2"
                    >
                      {theme === "light" ? (
                        <DrawerNavIcon name="moon-outline" size={16} color="var(--cc-text-secondary)" />
                      ) : (
                        <DrawerNavIcon name="sunny-outline" size={16} color="var(--cc-text-secondary)" />
                      )}
                      {theme === "light" ? "Dark mode" : "Light mode"}
                    </button>
                    {!isAdmin && (
                      <button
                        onClick={() => {
                          setProfileOpen(false)
                          router.push(portalCfg.selectCoursePath)
                        }}
                        className="w-full flex sm:hidden items-center gap-3 px-4 py-2.5 text-sm text-[var(--cc-text-secondary)] hover:bg-[var(--sidebar-accent)] transition-colors rounded-xl mx-2"
                      >
                        <DrawerNavIcon name="book-outline" size={16} color="var(--cc-text-secondary)" />
                        Switch course (full page)
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setProfileOpen(false)
                        router.push(`${basePath}/settings?section=appearance`)
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--cc-text-secondary)] hover:bg-[var(--sidebar-accent)] transition-colors rounded-xl mx-2"
                    >
                      <DrawerNavIcon name="color-palette-outline" size={16} color="var(--cc-text-secondary)" />
                      Appearance & themes
                    </button>
                    <button
                      onClick={() => {
                        setProfileOpen(false)
                        router.push(`${basePath}/settings`)
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--cc-text-secondary)] hover:bg-[var(--sidebar-accent)] transition-colors rounded-xl mx-2"
                    >
                      <DrawerNavIcon name="settings-outline" size={16} color="var(--cc-text-secondary)" />
                      Settings
                    </button>
                    <button
                      onClick={() => {
                        setProfileOpen(false)
                        router.push(`${basePath}/learning-center/help`)
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--cc-text-secondary)] hover:bg-[var(--sidebar-accent)] transition-colors rounded-xl mx-2"
                    >
                      <DrawerNavIcon name="help-circle-outline" size={16} color="var(--cc-text-secondary)" />
                      Help & Support
                    </button>
                    {!isAdmin && (
                      <button
                        onClick={() => {
                          setProfileOpen(false)
                          setInstructorDashboardVersion("v1")
                          router.push("/instructor/dashboard")
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--cc-text-secondary)] hover:bg-[var(--sidebar-accent)] transition-colors rounded-xl mx-2"
                      >
                        <DrawerNavIcon name="grid-outline" size={16} color="var(--cc-text-secondary)" />
                        Switch to Classic Dashboard
                      </button>
                    )}
                  </div>
                  <div className="border-t border-[var(--border)] py-2">
                    <button
                      onClick={() => {
                        setProfileOpen(false)
                        handleLogout()
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-500/10 transition-colors rounded-xl mx-2"
                    >
                      <DrawerNavIcon name="exit-outline" size={16} color="currentColor" />
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
          </div>

          {merged && !coraImmersive ? (
            <div className={magnificMergedBreadcrumbsClass} data-dashboard-breadcrumbs>
              <InstructorDashboardBreadcrumbs variant="embedded" />
            </div>
          ) : null}
        </div>

        <PopoverContent
          className="w-[min(100vw-2rem,28rem)] md:w-[var(--radix-popover-trigger-width)] overflow-hidden rounded-xl p-0 shadow-lg"
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
            <CommandList id="faculty-module-search-results" className="max-h-[min(320px,70vh)]">
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
                        className="flex items-center gap-2 cursor-pointer"
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
