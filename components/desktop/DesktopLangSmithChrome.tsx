"use client"

import {
  useEffect,
  useMemo,
  useState,
  type ComponentType,
  type ReactNode,
} from "react"
import { usePathname, useRouter } from "next/navigation"
import {
  ChevronDown,
  ChevronRight,
  LayoutDashboard,
  Lock,
  LogOut,
  Moon,
  PanelLeft,
  Search,
  Settings,
  Sparkles,
  Sun,
  User,
} from "lucide-react"
import { getInstructorData, getStudentData, logoutStudent, studentApiFetch } from "@/lib/auth"
import { logoutFaculty } from "@/lib/faculty-auth-flow"
import { COURSE_SWITCH_EVENT } from "@/lib/data/types"
import { isSummerProgramRole } from "@/lib/summer-camp/program-roles"
import { isInstructorImmersivePreviewPath } from "@/lib/dashboard-v2-layout"
import { CAMPER_DASHBOARD_LINK, CAMPER_NAV_GROUPS } from "@/lib/summer-camp/camper-nav"
import { buildFacultyNavFull } from "@/lib/faculty-portal-nav-config"
import {
  GUEST_DASHBOARD_ITEM,
  GUEST_SETTINGS_ITEM,
  filterGuestNavGroups,
} from "@/lib/guest/guest-nav"
import {
  DASHBOARD_LINK,
  NAV_GROUPS,
  SETTINGS_LINK,
  SUPPORT_GROUP,
} from "@/components/student/dashboard-v2/Sidebar"
import { useDashboardV2 } from "@/components/student/dashboard-v2/DashboardV2Context"
import { useInstructorDashboardV2 } from "@/components/instructor/dashboard-v2/InstructorDashboardV2Context"
import { useGuestDashboard } from "@/components/guest/dashboard/GuestDashboardContext"
import { NotificationBell } from "@/components/notification-bell"
import { InstructorNotificationBell } from "@/components/instructor-notification-bell"
import { useAppearance } from "@/components/appearance/AppearanceProvider"
import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler"
import { cachedFetchJson } from "@/lib/student-client-cache"
import { cn } from "@/lib/utils"
import { CoraNavIcon, CoraSidebarMark } from "@/components/cora/CoraLogo"
import { DrawerNavItem } from "@/components/dashboard-v2/DrawerNavItem"
import { CourseCollabLogo } from "@/components/course-collab-logo"
import {
  DashboardChromeTitlePortalContext,
  DesktopChromeTitle,
  DesktopChromeTitleActions,
  DesktopChromeTitleExtras,
} from "@/components/dashboard-v2/DashboardChromeTitlePortal"

export { DesktopChromeTitle, DesktopChromeTitleActions, DesktopChromeTitleExtras }

type ChromeNavItem = {
  id: string
  label: string
  href: string
  icon?: ComponentType<{ className?: string }>
  locked?: boolean
  shortcut?: string
}

type ChromeNavGroup = {
  id: string
  label?: string
  items: ChromeNavItem[]
}

type ChromeModel = {
  product: string
  application: string
  userName: string
  userEmail: string
  initials: string
  membershipBadge?: string
  settingsHref: string
  profileHref: string
  dashboardItem: ChromeNavItem
  groups: ChromeNavGroup[]
  settingsItem: ChromeNavItem
  onSignOut: () => void
  notification: ReactNode
}

function initialsFromName(name: string, fallback: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return fallback
  return parts
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase()
}

function isActiveHref(pathname: string, href: string) {
  const [pathOnly] = href.split("?")
  if (!pathOnly) return false
  if (pathname === pathOnly) return true
  if (
    pathOnly === "/student/dashboard-v2" ||
    pathOnly === "/faculty/dashboard" ||
    pathOnly === "/guest" ||
    pathOnly === "/student/dashboard-v2/summer-camp"
  ) {
    return pathname === pathOnly
  }
  return pathname.startsWith(`${pathOnly}/`)
}

function pageTitle(pathname: string, items: ChromeNavItem[]) {
  const exact = items.find((item) => pathname === item.href.split("?")[0])
  if (exact) return exact.label
  const nested = [...items]
    .sort((a, b) => b.href.length - a.href.length)
    .find((item) => pathname.startsWith(`${item.href.split("?")[0]}/`))
  return nested?.label ?? "Dashboard"
}

function isCoraNavItem(item: ChromeNavItem) {
  return item.id === "ai-tutor" || item.id === "cora-copilot" || item.icon === CoraSidebarMark
}

function NavRow({
  item,
  active,
  collapsed,
  onClick,
}: {
  item: ChromeNavItem
  active: boolean
  collapsed: boolean
  onClick?: () => void
}) {
  const Icon = item.icon ?? LayoutDashboard
  const coraItem = isCoraNavItem(item)

  return (
    <DrawerNavItem
      href={onClick ? undefined : item.href}
      label={item.label}
      isActive={active}
      collapsed={collapsed}
      onClick={onClick}
      icon={coraItem ? undefined : Icon}
      iconNode={
        coraItem ? (
          <CoraNavIcon
            className={cn(
              "transition-colors duration-300",
              active
                ? "text-[var(--cc-drawer-primary)]"
                : "text-[#7c6cf0] group-hover:text-[var(--cc-drawer-label)]",
            )}
          />
        ) : undefined
      }
      compact
      trailing={
        <>
          {item.locked ? (
            <Lock className="size-3 shrink-0 text-[var(--cc-drawer-label-secondary)]" strokeWidth={2.25} />
          ) : null}
          {item.shortcut ? (
            <kbd className="rounded border border-[var(--cc-drawer-soft-border,#e5e7eb)] bg-[var(--cc-drawer-nav-idle-bg,#fff)] px-1.5 py-0.5 text-[10px] text-[var(--cc-drawer-label-secondary)]">
              {item.shortcut}
            </kbd>
          ) : null}
        </>
      }
    />
  )
}

function DesktopLangSmithChrome({
  model,
  hideSidebar,
  collapsed,
  onCollapsedChange,
  children,
}: {
  model: ChromeModel
  hideSidebar?: boolean
  collapsed: boolean
  onCollapsedChange: (collapsed: boolean) => void
  children: ReactNode
}) {
  const pathname = usePathname() ?? "/"
  const router = useRouter()
  const { isDark, setAppearanceMode, toggleLightDark } = useAppearance()
  const [profileOpen, setProfileOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [titleSlotEl, setTitleSlotEl] = useState<HTMLDivElement | null>(null)
  const [actionSlotEl, setActionSlotEl] = useState<HTMLDivElement | null>(null)
  const [replaceTitle, setReplaceTitle] = useState(false)
  const titlePortalApi = useMemo(
    () => ({
      titleEl: titleSlotEl,
      actionEl: actionSlotEl,
      setReplaceTitle,
      registerTitleSlot: setTitleSlotEl,
      registerActionSlot: setActionSlotEl,
    }),
    [actionSlotEl, titleSlotEl],
  )

  const allItems = useMemo(
    () => [model.dashboardItem, ...model.groups.flatMap((group) => group.items), model.settingsItem],
    [model],
  )
  const title = pageTitle(pathname, allItems)
  const crumbs = [model.application, title]
  const filteredSearch = allItems.filter((item) =>
    item.label.toLowerCase().includes(searchQuery.trim().toLowerCase()),
  )

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setSearchOpen((open) => !open)
      }
      if (event.key === "Escape") {
        setSearchOpen(false)
        setProfileOpen(false)
      }
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [])

  return (
    <DashboardChromeTitlePortalContext.Provider value={titlePortalApi}>
    <div
      className="cc-langsmith-chrome flex h-full min-h-0 w-full flex-1 overflow-hidden bg-white text-[#111827] dark:bg-[#111111] dark:text-white"
      onClick={() => {
        if (profileOpen) setProfileOpen(false)
      }}
    >
      {!hideSidebar ? (
        <aside
          className={cn(
            "flex h-full shrink-0 flex-col border-r border-[#e5e7eb] bg-white transition-[width] duration-200 dark:border-[#262626] dark:bg-[#111111]",
            collapsed ? "w-[72px]" : "w-[248px]",
          )}
        >
          <div className={cn("flex items-center gap-1 border-b border-[#e5e7eb] px-2 py-2 dark:border-[#262626]", collapsed && "justify-center")}>
            {!collapsed ? (
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-1.5 rounded-[6px] px-1.5 py-1 text-left hover:bg-[#f3f4f6] dark:hover:bg-[#1a1a1a]"
                aria-label={model.product}
              >
                <CourseCollabLogo
                  height={22}
                  tone="primary"
                  withWordmark
                  frameClassName="rounded-md"
                  className="min-w-0"
                  wordmarkClassName="truncate text-[13px] font-semibold leading-none tracking-tight"
                />
                <ChevronDown className="size-3.5 shrink-0 text-[#9ca3af]" />
              </button>
            ) : (
              <CourseCollabLogo height={28} tone="primary" frameClassName="rounded-md" />
            )}
            <button
              type="button"
              onClick={() => onCollapsedChange(!collapsed)}
              className="inline-flex size-8 items-center justify-center rounded-[6px] text-[#6b7280] hover:bg-[#f3f4f6] dark:hover:bg-[#1a1a1a]"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <PanelLeft className="size-4" />
            </button>
          </div>

          <nav className={cn("min-h-0 flex-1 overflow-y-auto px-2 py-3", collapsed && "px-1.5")}>
            <div className="space-y-0.5">
              <NavRow
                item={{ id: "search", label: "Search", href: "#", icon: Search, shortcut: "⌘K" }}
                active={false}
                collapsed={collapsed}
                onClick={() => setSearchOpen(true)}
              />
              <NavRow
                item={model.dashboardItem}
                active={isActiveHref(pathname, model.dashboardItem.href)}
                collapsed={collapsed}
              />
            </div>
            {model.groups.map((group) => (
              <div key={group.id} className="mt-3">
                <div className="mb-2 border-t border-[#e5e7eb] dark:border-[#262626]" />
                {group.label && !collapsed ? (
                  <p className="px-2.5 pb-1.5 text-[11px] font-medium text-[#9ca3af]">{group.label}</p>
                ) : null}
                <div className="space-y-0.5">
                  {group.items.map((item) => (
                    <NavRow
                      key={item.id}
                      item={item}
                      active={isActiveHref(pathname, item.href)}
                      collapsed={collapsed}
                    />
                  ))}
                </div>
              </div>
            ))}
          </nav>

          <div className="border-t border-[#e5e7eb] p-2 dark:border-[#262626]">
            <NavRow
              item={model.settingsItem}
              active={isActiveHref(pathname, model.settingsItem.href)}
              collapsed={collapsed}
            />
            <button
              type="button"
              className={cn(
                "mt-1 flex w-full items-center rounded-[6px] hover:bg-[#f3f4f6] dark:hover:bg-[#1a1a1a]",
                collapsed ? "h-10 justify-center" : "gap-2.5 px-2 py-2",
              )}
              onClick={(event) => {
                event.stopPropagation()
                setProfileOpen(true)
              }}
            >
              <span className="flex size-7 shrink-0 items-center justify-center rounded-[6px] bg-[#582c83] text-[11px] font-semibold text-white">
                {model.initials.slice(0, 1)}
              </span>
              {!collapsed ? (
                <span className="min-w-0 text-left">
                  <span className="block truncate text-[12px] font-medium leading-none">{model.userName}</span>
                  <span className="mt-1 block truncate text-[11px] leading-none text-[#6b7280]">{model.userEmail}</span>
                </span>
              ) : null}
            </button>
          </div>
        </aside>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col bg-white dark:bg-[#111111]">
        <header className="border-b border-[#e5e7eb] dark:border-[#262626]">
          <div className="flex items-center justify-between gap-3 px-5 pt-2.5">
            <div className="flex min-w-0 items-center gap-1.5 text-[12px] text-[#6b7280]">
              {crumbs.map((crumb, index) => (
                <span key={`${crumb}-${index}`} className="flex min-w-0 items-center gap-1.5">
                  {index > 0 ? <ChevronRight className="size-3 shrink-0" /> : null}
                  <span className={cn("truncate", index === crumbs.length - 1 && "text-[#111827] dark:text-white")}>
                    {crumb}
                  </span>
                </span>
              ))}
            </div>
            <div className="flex shrink-0 items-center gap-1.5" onClick={(event) => event.stopPropagation()}>
              <div ref={setActionSlotEl} className="flex shrink-0 items-center" />
              {model.membershipBadge ? (
                <span className="hidden rounded-full border border-[#e5e7eb] px-2 py-1 text-[11px] text-[#6b7280] sm:inline dark:border-[#262626]">
                  {model.membershipBadge}
                </span>
              ) : null}
              <AnimatedThemeToggler
                theme={isDark ? "dark" : "light"}
                onThemeChange={setAppearanceMode}
                className="inline-flex size-8 items-center justify-center rounded-full text-[#6b7280] hover:bg-[#f3f4f6] dark:hover:bg-[#1a1a1a]"
                aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
              >
                {isDark ? <Moon className="size-4" /> : <Sun className="size-4" />}
              </AnimatedThemeToggler>
              <div className="[&_button]:size-8 [&_button]:rounded-full">{model.notification}</div>
              <div className="relative">
                <button
                  type="button"
                  aria-expanded={profileOpen}
                  aria-haspopup="menu"
                  onClick={() => setProfileOpen((open) => !open)}
                  className="inline-flex h-8 items-center gap-2 rounded-full border border-[#e5e7eb] bg-white px-1.5 pr-2 hover:bg-[#f9fafb] dark:border-[#262626] dark:bg-[#171717]"
                >
                  <span className="flex size-6 items-center justify-center rounded-full bg-[#582c83] text-[10px] font-semibold text-white">
                    {model.initials}
                  </span>
                  <span className="hidden text-[12px] font-medium sm:block">{model.userName}</span>
                  <ChevronDown className="size-3.5 text-[#9ca3af]" />
                </button>
                {profileOpen ? (
                  <div
                    role="menu"
                    className="absolute right-0 top-[calc(100%+6px)] z-30 w-56 overflow-hidden rounded-[8px] border border-[#e5e7eb] bg-white dark:border-[#262626] dark:bg-[#171717]"
                  >
                    <div className="border-b border-[#e5e7eb] px-3 py-2.5 dark:border-[#262626]">
                      <p className="text-[13px] font-medium">{model.userName}</p>
                      <p className="mt-0.5 truncate text-[11px] text-[#6b7280]">{model.userEmail}</p>
                    </div>
                    <button
                      type="button"
                      role="menuitem"
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] hover:bg-[#f3f4f6] dark:hover:bg-[#1a1a1a]"
                      onClick={() => {
                        setProfileOpen(false)
                        router.push(model.profileHref)
                      }}
                    >
                      <User className="size-3.5" />
                      Profile
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] hover:bg-[#f3f4f6] dark:hover:bg-[#1a1a1a]"
                      onClick={() => {
                        setProfileOpen(false)
                        router.push(model.settingsHref)
                      }}
                    >
                      <Settings className="size-3.5" />
                      Settings
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] hover:bg-[#f3f4f6] dark:hover:bg-[#1a1a1a]"
                      onClick={() => {
                        setProfileOpen(false)
                        toggleLightDark()
                      }}
                    >
                      <Sun className="size-3.5" />
                      {isDark ? "Light mode" : "Dark mode"}
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="flex w-full items-center gap-2 border-t border-[#e5e7eb] px-3 py-2 text-left text-[13px] text-[#b91c1c] hover:bg-[#fef2f2] dark:border-[#262626]"
                      onClick={() => {
                        setProfileOpen(false)
                        model.onSignOut()
                      }}
                    >
                      <LogOut className="size-3.5" />
                      Sign out
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex min-w-0 items-center gap-3 px-5 pb-2 pt-1.5">
            {replaceTitle ? null : (
              <h1 className="shrink-0 text-[16px] font-semibold tracking-tight">{title}</h1>
            )}
            <div ref={setTitleSlotEl} className="min-w-0 flex-1" />
          </div>
        </header>

        <main
          data-desktop-native-content
          className="cc-desktop-native-content min-h-0 flex-1 overflow-auto bg-[#f3f4f6] dark:bg-[#0b0b0b]"
        >
          {children}
        </main>
      </div>

      {searchOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/20 px-4 pt-[12vh]"
          onClick={() => setSearchOpen(false)}
        >
          <div
            className="w-full max-w-lg overflow-hidden rounded-[10px] border border-[#e5e7eb] bg-white shadow-xl dark:border-[#262626] dark:bg-[#171717]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b border-[#e5e7eb] px-3 dark:border-[#262626]">
              <Search className="size-4 text-[#9ca3af]" />
              <input
                autoFocus
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search modules"
                className="h-11 w-full bg-transparent text-[13px] outline-none"
              />
              <kbd className="rounded border border-[#e5e7eb] px-1.5 py-0.5 text-[10px] text-[#6b7280] dark:border-[#262626]">
                esc
              </kbd>
            </div>
            <div className="max-h-72 overflow-y-auto p-1.5">
              {filteredSearch.length === 0 ? (
                <p className="px-3 py-6 text-center text-[13px] text-[#6b7280]">No matching modules</p>
              ) : (
                filteredSearch.map((item) => {
                  const Icon = item.icon ?? LayoutDashboard
                  const coraItem = isCoraNavItem(item)
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className="flex w-full items-center gap-2.5 rounded-[6px] px-2.5 py-2 text-left text-[13px] hover:bg-[#f3f4f6] dark:hover:bg-[#1a1a1a]"
                      onClick={() => {
                        setSearchOpen(false)
                        setSearchQuery("")
                        router.push(item.href)
                      }}
                    >
                      {coraItem ? (
                        <CoraNavIcon className="text-[#7c6cf0]" />
                      ) : (
                        <Icon className="size-4 text-[#6b7280]" />
                      )}
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.locked ? <Lock className="size-3 text-[#9ca3af]" /> : null}
                    </button>
                  )
                })
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
    </DashboardChromeTitlePortalContext.Provider>
  )
}

function useStudentChromeModel(summer: boolean): ChromeModel {
  const pathname = usePathname() ?? "/"
  const [revision, setRevision] = useState(0)
  const [membershipBadge, setMembershipBadge] = useState("Scholar")

  useEffect(() => {
    const sync = () => setRevision((value) => value + 1)
    window.addEventListener("student-session-ready", sync)
    window.addEventListener(COURSE_SWITCH_EVENT, sync)
    return () => {
      window.removeEventListener("student-session-ready", sync)
      window.removeEventListener(COURSE_SWITCH_EVENT, sync)
    }
  }, [])

  useEffect(() => {
    const data = getStudentData()
    const dbId = data?.databaseId
    if (!dbId || summer) return
    void cachedFetchJson(
      `membership:${dbId}`,
      async () => {
        const res = await studentApiFetch(`/api/student/membership?studentId=${dbId}`)
        if (!res.ok) throw new Error("membership")
        return res.json()
      },
      300_000,
    )
      .then((json) => setMembershipBadge(String(json?.membership?.tier ?? "Scholar")))
      .catch(() => {})
  }, [summer, revision])

  const student = getStudentData()
  const isSummer =
    summer ||
    pathname.includes("/summer-camp") ||
    student?.isSummerCamper === true ||
    isSummerProgramRole(student?.studentProgramRole ?? "")

  const dashboardItem = isSummer ? CAMPER_DASHBOARD_LINK : DASHBOARD_LINK
  const groups: ChromeNavGroup[] = isSummer
    ? CAMPER_NAV_GROUPS.map((group) => ({
        id: group.id,
        label: group.label,
        items: group.items.filter((item) => item.id !== dashboardItem.id),
      }))
    : [...NAV_GROUPS, SUPPORT_GROUP]

  return {
    product: "CourseCollab",
    application: isSummer ? "Summer Camp" : student?.courseCode || "Student",
    userName: student?.name || (isSummer ? "Camper" : "Student"),
    userEmail: student?.id || "",
    initials: initialsFromName(student?.name || (isSummer ? "SC" : "ST"), isSummer ? "SC" : "ST"),
    membershipBadge: isSummer ? "Summer" : membershipBadge,
    settingsHref: SETTINGS_LINK.href,
    profileHref: SETTINGS_LINK.href,
    dashboardItem,
    groups,
    settingsItem: SETTINGS_LINK,
    onSignOut: () => {
      void logoutStudent()
    },
    notification: <NotificationBell variant="app-bar" />,
  }
}

export function DesktopStudentLangSmithChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/"
  const { sidebarCollapsed, setSidebarCollapsed, coraImmersive } = useDashboardV2()
  const model = useStudentChromeModel(pathname.includes("/summer-camp"))
  const hideSidebar =
    coraImmersive || pathname.includes("/codebench/ide") || Boolean(pathname.match(/\/lectures\/\d+$/))

  return (
    <DesktopLangSmithChrome
      model={model}
      hideSidebar={hideSidebar}
      collapsed={sidebarCollapsed}
      onCollapsedChange={setSidebarCollapsed}
    >
      {children}
    </DesktopLangSmithChrome>
  )
}

export function DesktopFacultyLangSmithChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/"
  const { dashboardLink, navGroups, sidebarCollapsed, setSidebarCollapsed, coraImmersive } =
    useInstructorDashboardV2()
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    const sync = () => setRevision((value) => value + 1)
    window.addEventListener(COURSE_SWITCH_EVENT, sync)
    return () => window.removeEventListener(COURSE_SWITCH_EVENT, sync)
  }, [])

  const faculty = revision >= 0 ? getInstructorData() : null
  const fallback = buildFacultyNavFull()
  const dashboardItem = dashboardLink ?? fallback.dashboardLink
  const groups = (navGroups.length > 0 ? navGroups : fallback.navGroups)
    .filter((group) => group.id !== "settings")
    .map((group) => ({
      id: group.id,
      label: group.title,
      items: group.items,
    }))
  const settingsItem = {
    id: "settings",
    label: "Settings",
    href: "/faculty/dashboard/settings",
    icon: Settings,
  }
  const hideSidebar = coraImmersive || isInstructorImmersivePreviewPath(pathname)

  const model: ChromeModel = {
    product: "CourseCollab",
    application: faculty?.selectedCourseCode || faculty?.selectedCatalogCourseCode || "Faculty",
    userName: faculty?.name || faculty?.username || "Faculty",
    userEmail: faculty?.email || faculty?.username || "",
    initials: initialsFromName(faculty?.name || faculty?.username || "FC", "FC"),
    membershipBadge: "Faculty",
    settingsHref: settingsItem.href,
    profileHref: settingsItem.href,
    dashboardItem,
    groups,
    settingsItem,
    onSignOut: () => {
      void logoutFaculty()
    },
    notification: <InstructorNotificationBell variant="app-bar" />,
  }

  return (
    <DesktopLangSmithChrome
      model={model}
      hideSidebar={hideSidebar}
      collapsed={sidebarCollapsed}
      onCollapsedChange={setSidebarCollapsed}
    >
      {children}
    </DesktopLangSmithChrome>
  )
}

export function DesktopGuestLangSmithChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/"
  const { sidebarCollapsed, setSidebarCollapsed, coraImmersive, entitlements } = useGuestDashboard()
  const student = getStudentData()
  const groups = filterGuestNavGroups({
    capabilities: entitlements.capabilities,
    plan: entitlements.plan,
  })
  const hideSidebar =
    coraImmersive && (pathname.startsWith("/guest/cora-career") || pathname.startsWith("/guest/career"))

  const model: ChromeModel = {
    product: "CourseCollab",
    application: "Career Member",
    userName: student?.name || "Career Member",
    userEmail: student?.id || "",
    initials: initialsFromName(student?.name || "CM", "CM"),
    membershipBadge: entitlements.plan === "guest_free" ? "Guest" : "Cora Career",
    settingsHref: GUEST_SETTINGS_ITEM.href,
    profileHref: "/guest/settings?section=profile",
    dashboardItem: GUEST_DASHBOARD_ITEM,
    groups,
    settingsItem: GUEST_SETTINGS_ITEM,
    onSignOut: () => {
      void logoutStudent(true)
    },
    notification: <NotificationBell variant="app-bar" />,
  }

  return (
    <DesktopLangSmithChrome
      model={model}
      hideSidebar={hideSidebar}
      collapsed={sidebarCollapsed}
      onCollapsedChange={setSidebarCollapsed}
    >
      {children}
    </DesktopLangSmithChrome>
  )
}
