"use client"

import type { ReactNode } from "react"
import { useIsLg } from "@/hooks/use-breakpoint"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useIntentPrefetch } from "@/hooks/data/use-intent-prefetch"
import {
  LayoutDashboard,
  ClipboardList,
  History,
  Lightbulb,
  Code2,
  Search,
  UsersRound,
  FolderKanban,
  BookOpen,
  FileText,
  GraduationCap,
  MessageSquare,
  Mail,
  Calendar,
  CalendarClock,
  CalendarDays,
  Trophy,
  Gem,
  Megaphone,
  Layers,
  Zap,
  Presentation,
  Lock,
  LockOpen,
  Settings,
  HelpCircle,
  LifeBuoy,
  Send,
  Bug,
  Sparkles,
  Clock,
  Mic,
  FilePenLine,
  ScrollText,
  Shield,
  TrendingUp,
  ClipboardCheck,
  ChartColumn,
} from "lucide-react"
import { isSummerProgramRole } from "@/lib/summer-camp/program-roles"
import { cn } from "@/lib/utils"
import { CORA_NAV_LABEL } from "@/lib/cora/constants"
import { CoraSidebarMark } from "@/components/cora/CoraLogo"
import { useDashboardV2 } from "./DashboardV2Context"
import { ShellSidebarHeader } from "@/components/dashboard-v2/ShellSidebarHeader"
import { ShellSidebarFooter } from "@/components/dashboard-v2/ShellSidebarFooter"
import { magnificShellCardClass, magnificSidebarNavIconClass, magnificSidebarNavItemActiveClass, magnificSidebarNavItemClass } from "@/lib/appearance/magnific-shell"
import { useEffect, useState } from "react"
import { getStudentData, studentApiFetch } from "@/lib/auth"
import { COURSE_SWITCH_EVENT } from "@/lib/data/types"
import { cachedFetchJson } from "@/lib/student-client-cache"
import {
  CAMPER_NAV_GROUPS,
  SUMMER_CAMP_DASHBOARD_BASE,
} from "@/lib/summer-camp/camper-nav"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

type MembershipTier = "Scholar" | "Explorer" | "Trailblazer"

type NavItem = {
  id: string
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  locked?: boolean
  /** Minimum tier required to unlock (Explorer+ or Trailblazer) */
  minTier?: MembershipTier
  proBadge?: boolean
  notificationCount?: number
}

const TIER_ORDER: Record<MembershipTier, number> = {
  Scholar: 0,
  Explorer: 1,
  Trailblazer: 2,
}

function hasAccessToModule(tier: MembershipTier | null, minTier?: MembershipTier): boolean {
  if (!minTier || !tier) return false
  return TIER_ORDER[tier] >= TIER_ORDER[minTier]
}

type NavGroup = {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  items: NavItem[]
}

export const DASHBOARD_LINK: NavItem = {
  id: "dashboard",
  label: "Dashboard",
  href: "/student/dashboard-v2",
  icon: LayoutDashboard,
}

const MY_COURSES_LINK: NavItem = {
  id: "my-courses",
  label: "My Courses",
  href: "/auth/student/select-course",
  icon: GraduationCap,
}

export const NAV_GROUPS: NavGroup[] = [
  {
    id: "learning-center",
    label: "Learning Center",
    icon: Lightbulb,
    items: [
      { id: "lectures", label: "Lectures", href: "/student/dashboard-v2/lectures", icon: Presentation },
      { id: "notes", label: "My Notes", href: "/student/dashboard-v2/notes", icon: FilePenLine },
      { id: "flashcards", label: "Flashcards", href: "/student/dashboard-v2/flashcards", icon: Layers },
      { id: "ai-notetaker", label: "AI Notetaker", href: "/student/dashboard-v2/ai-notetaker", icon: Mic, locked: true, minTier: "Explorer" },
      { id: "practice", label: "Practice Hub", href: "/student/dashboard-v2/practice", icon: Lightbulb, locked: true, minTier: "Explorer" },
      { id: "ai-tutor", label: CORA_NAV_LABEL, href: "/student/dashboard-v2/ai-tutor", icon: CoraSidebarMark },
      { id: "codebench", label: "CodeBench", href: "/student/dashboard-v2/codebench", icon: Code2, locked: true, minTier: "Trailblazer" },
    ],
  },
  {
    id: "assessments",
    label: "Assessments",
    icon: ClipboardList,
    items: [
      { id: "quizzes", label: "Quizzes", href: "/student/dashboard-v2/quizzes", icon: ClipboardList },
      { id: "quiz-history", label: "History", href: "/student/dashboard-v2/quiz-history", icon: History },
      { id: "homework", label: "Homework", href: "/student/dashboard-v2/homework", icon: BookOpen },
      { id: "mid-semester-exams", label: "Mid-Semester", href: "/student/dashboard-v2/mid-semester-exams", icon: FileText },
      { id: "final-exams", label: "Finals", href: "/student/dashboard-v2/final-exams", icon: GraduationCap },
      { id: "grades", label: "Grades", href: "/student/dashboard-v2/grades", icon: ChartColumn },
    ],
  },
  {
    id: "collaboration",
    label: "Collaboration",
    icon: UsersRound,
    items: [
      { id: "forum", label: "Forum Hub", href: "/student/dashboard-v2/forum", icon: MessageSquare },
      { id: "messages", label: "Messages", href: "/student/dashboard-v2/messages", icon: Mail },
      { id: "groups", label: "Groups", href: "/student/dashboard-v2/groups", icon: UsersRound },
      { id: "projects", label: "Projects", href: "/student/dashboard-v2/projects", icon: FolderKanban },
      { id: "playground", label: "Playground", href: "/student/dashboard-v2/playground", icon: Zap },
    ],
  },
  {
    id: "performance-rewards",
    label: "Performance & Rewards",
    icon: Trophy,
    items: [
      { id: "classroom-points", label: "Classroom Points", href: "/student/dashboard-v2/classroom-points", icon: Trophy },
      { id: "attendance", label: "Attendance", href: "/student/dashboard-v2/attendance", icon: Calendar },
      { id: "trade-center", label: "Trade Center", href: "/student/dashboard-v2/trade-center", icon: Gem },
    ],
  },
  {
    id: "course-info",
    label: "Course Info",
    icon: Megaphone,
    items: [
      { id: "announcements", label: "Announcements", href: "/student/dashboard-v2/announcements", icon: Megaphone },
      { id: "progress-review", label: "Progress Review", href: "/student/dashboard-v2/progress-review", icon: TrendingUp },
      { id: "syllabus", label: "Syllabus", href: "/student/dashboard-v2/syllabus", icon: ScrollText },
      { id: "calendar", label: "Calendar", href: "/student/dashboard-v2/calendar", icon: CalendarDays },
      { id: "schedule-adjustment", label: "Schedule Adjustment", href: "/student/dashboard-v2/schedule-adjustment", icon: CalendarClock },
      { id: "timeline", label: "Semester Timeline", href: "/student/dashboard-v2/timeline", icon: Clock },
      { id: "office-hours", label: "Office Hours", href: "/student/dashboard-v2/office-hours", icon: Clock },
      { id: "course-policies", label: "Policies", href: "/student/dashboard-v2/course-info/policies", icon: Shield },
      { id: "course-evaluation", label: "Course Evaluation", href: "/student/dashboard-v2/course-info/course-evaluation", icon: ClipboardCheck },
      { id: "recommendations", label: "Recommendation Letters", href: "/student/dashboard-v2/recommendations", icon: FilePenLine },
    ],
  },
]

export const SUPPORT_GROUP: NavGroup = {
  id: "support",
  label: "Support",
  icon: LifeBuoy,
  items: [
    { id: "membership", label: "View Plans", href: "/student/dashboard-v2/membership", icon: Gem },
    { id: "report-bug", label: "Report Bug", href: "/student/dashboard-v2/report-bug", icon: Bug },
    { id: "help-center", label: "Help Center", href: "/student/dashboard-v2/help", icon: HelpCircle },
    { id: "submit-ticket", label: "Submit Ticket", href: "/student/dashboard-v2/submit-ticket", icon: Send },
    { id: "feature-requests", label: "Feature Requests", href: "/student/dashboard-v2/feature-requests", icon: Sparkles },
  ],
}

export const SETTINGS_LINK: NavItem = {
  id: "settings",
  label: "Settings",
  href: "/student/dashboard-v2/settings",
  icon: Settings,
}

/** Rail mode: show icon tooltips when sidebar is collapsed to icon rail. */
const SIDEBAR_NAV_ROW =
  "flex w-full items-center gap-2.5 px-3 py-2 text-[14px] font-normal"

function SidebarNavIcon({
  children,
  active = false,
}: {
  children: ReactNode
  active?: boolean
}) {
  return (
    <span
      className={cn(
        "inline-flex size-[18px] shrink-0 items-center justify-center [&>svg]:size-[18px]",
        magnificSidebarNavIconClass(active),
      )}
    >
      {children}
    </span>
  )
}

function SidebarCollapsedTooltip({
  label,
  collapsed,
  children,
}: {
  label: string
  collapsed: boolean
  children: ReactNode
}) {
  if (!collapsed) return <>{children}</>
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={10} className="text-xs font-medium">
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

/** Returns the most specific (longest path) matching item to avoid multiple highlights for nested routes (e.g. codebench + codebench/more) */
function getActiveItemInGroup(group: NavGroup, pathname: string): NavItem | null {
  const matches = group.items.filter(
    (item) => pathname === item.href || pathname.startsWith(item.href + "/")
  )
  if (matches.length === 0) return null
  return matches.reduce((best, curr) => (curr.href.length > best.href.length ? curr : best))
}

function NavLink({
  item,
  isActive,
  collapsed,
  onNavigate,
  membershipTier,
  navGroupId,
}: {
  item: NavItem
  isActive: boolean
  collapsed: boolean
  onNavigate: () => void
  membershipTier: MembershipTier | null
  navGroupId?: string
}) {
  const { onIntentEnter, onIntentLeave } = useIntentPrefetch()
  const Icon = item.icon
  const hasAccess = item.locked && item.minTier ? hasAccessToModule(membershipTier, item.minTier) : false
  const showLocked = item.locked && !item.proBadge && !hasAccess
  const showUnlocked = item.locked && !item.proBadge && hasAccess

  const link = (
    <Link
      href={item.href}
      onClick={onNavigate}
      onMouseEnter={() => onIntentEnter(item.href)}
      onMouseLeave={onIntentLeave}
      onFocus={() => onIntentEnter(item.href)}
      className={cn(
        "group",
        SIDEBAR_NAV_ROW,
        magnificSidebarNavItemClass,
        collapsed && "justify-center px-2 py-2.5",
        isActive ? magnificSidebarNavItemActiveClass : null,
        showLocked && !isActive && "opacity-60",
      )}
    >
      <SidebarNavIcon active={isActive}>
        {item.id === "ai-tutor" ? (
          <CoraSidebarMark />
        ) : (
          <Icon strokeWidth={1.75} aria-hidden />
        )}
      </SidebarNavIcon>
      {!collapsed && (
        <span className="flex-1 truncate leading-5">{item.label}</span>
      )}
      {!collapsed && item.notificationCount !== undefined && item.notificationCount > 0 && (
        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-red-500 text-[10px] font-semibold text-white" aria-label={`${item.notificationCount} notifications`}>
          {item.notificationCount > 99 ? "99+" : item.notificationCount}
        </span>
      )}
      {!collapsed && item.proBadge && (
        <span className="shrink-0 rounded-md bg-[var(--cc-accent)] px-2 py-0.5 text-[10px] font-medium text-white">
          Pro
        </span>
      )}
      {!collapsed && showLocked && (
        <span
          className="flex size-[26px] shrink-0 items-center justify-center rounded-full bg-[var(--cc-drawer-icon-well-bg)]"
          aria-label="Upgrade to unlock"
        >
          <Lock className="h-[11px] w-[11px] text-[var(--cc-drawer-label-secondary)]" strokeWidth={2.25} />
        </span>
      )}
      {!collapsed && showUnlocked && (
        <LockOpen
          className="h-4 w-4 shrink-0 text-[var(--cc-drawer-primary)]"
          aria-label="Unlocked"
        />
      )}
    </Link>
  )

  return (
    <SidebarCollapsedTooltip label={item.label} collapsed={collapsed}>
      {link}
    </SidebarCollapsedTooltip>
  )
}

function FlatNavSection({
  group,
  pathname,
  collapsed,
  onNavigate,
  membershipTier,
  showLeadingDivider = true,
}: {
  group: NavGroup
  pathname: string
  collapsed: boolean
  onNavigate: () => void
  membershipTier: MembershipTier | null
  showLeadingDivider?: boolean
}) {
  const activeChild = getActiveItemInGroup(group, pathname)

  return (
    <section className="pt-0.5" data-tour={`nav-${group.id}`}>
      {showLeadingDivider ? (
        <div className="my-2 border-t border-[#EBEBEB] dark:border-[#262626]" aria-hidden />
      ) : null}
      <div className="space-y-0.5">
        {group.items.map((item) => (
          <NavLink
            key={item.id}
            item={item}
            isActive={activeChild?.id === item.id}
            collapsed={collapsed}
            onNavigate={onNavigate}
            membershipTier={membershipTier}
            navGroupId={group.id}
          />
        ))}
      </div>
    </section>
  )
}

/** Premium Sidebar — Magnific-style flat grouped nav (footer: updates + upgrade). */
export function StudentSidebarV2() {
  const {
    mobileSidebarOpen,
    setMobileSidebarOpen,
    sidebarCollapsed,
    setSearchOpen,
  } = useDashboardV2()
  const pathname = usePathname()
  const isLg = useIsLg()
  const [membershipTier, setMembershipTier] = useState<MembershipTier | null>(null)
  const [studentName, setStudentName] = useState("")
  const [isSummerCamper, setIsSummerCamper] = useState(false)
  const [showMyCourses, setShowMyCourses] = useState(false)

  const isOnSummerCampRoute = Boolean(pathname?.startsWith(SUMMER_CAMP_DASHBOARD_BASE))
  const showSummerCampNav = isSummerCamper || isOnSummerCampRoute
  const navGroups = showSummerCampNav ? CAMPER_NAV_GROUPS : NAV_GROUPS
  const dashboardLink = DASHBOARD_LINK

  useEffect(() => {
    const sync = () => {
      const data = getStudentData()
      setStudentName(data?.name?.trim() || "")
      setIsSummerCamper(
        !!(data?.isSummerCamper || isSummerProgramRole(data?.studentProgramRole ?? "")),
      )
      setShowMyCourses((data?.enrollments?.length ?? 0) > 1)
    }
    sync()
    window.addEventListener(COURSE_SWITCH_EVENT, sync)
    window.addEventListener("student-session-ready", sync)
    return () => {
      window.removeEventListener(COURSE_SWITCH_EVENT, sync)
      window.removeEventListener("student-session-ready", sync)
    }
  }, [pathname])

  useEffect(() => {
    if (showSummerCampNav) return
    const studentId = typeof window !== "undefined" ? sessionStorage.getItem("studentDatabaseId") : null
    if (!studentId) return

    void cachedFetchJson(
      `membership:${studentId}`,
      async () => {
        const res = await studentApiFetch(`/api/student/membership?studentId=${studentId}`)
        if (!res.ok) throw new Error("membership")
        return res.json()
      },
      300_000,
    )
      .then((data) => {
        const tier = data?.membership?.tier || "Scholar"
        setMembershipTier(
          ["Scholar", "Explorer", "Trailblazer"].includes(tier) ? (tier as MembershipTier) : "Scholar",
        )
      })
      .catch(() => setMembershipTier("Scholar"))
  }, [showSummerCampNav])

  /** Icon-only rail is desktop-only; mobile drawer always shows labels. */
  const iconOnlySidebar = isLg && sidebarCollapsed && !mobileSidebarOpen

  /** Close mobile drawer only — never force-collapse the desktop rail on nav. */
  const onNavigate = () => {
    setMobileSidebarOpen(false)
  }

  const desktopSidebarWidthClass = sidebarCollapsed
    ? "lg:w-[72px] lg:min-w-[72px] lg:max-w-[72px]"
    : "lg:w-[230px] lg:min-w-[230px] lg:max-w-[230px]"

  const homeHref = showSummerCampNav ? SUMMER_CAMP_DASHBOARD_BASE : "/student/dashboard-v2"

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] lg:hidden transition-opacity duration-300",
          mobileSidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
        onClick={() => setMobileSidebarOpen(false)}
        aria-hidden
      />

      <aside
        data-tour="sidebar"
        className={cn(
          "z-50 flex shrink-0 flex-col overflow-hidden transition-[width] duration-300 ease-out",
          desktopSidebarWidthClass,
          /* Desktop: floating card — inset from shell padding, rounded, shadow */
          magnificShellCardClass,
          "lg:h-full",
          /* Mobile: slide-in panel */
          "max-lg:fixed max-lg:left-0 max-lg:top-0 max-lg:h-[100dvh] max-lg:w-[min(80vw,280px)] max-lg:max-w-[280px]",
          "max-lg:rounded-r-2xl max-lg:border-r max-lg:border-[#EBEBEB] max-lg:bg-white max-lg:shadow-xl",
          "dark:max-lg:bg-[#111111] dark:max-lg:border-[#262626]",
          mobileSidebarOpen ? "max-lg:translate-x-0" : "max-lg:-translate-x-full",
        )}
      >
        <nav className="flex min-h-0 flex-1 flex-col overflow-hidden px-2 pb-2 pt-1 sm:px-2.5">
          <TooltipProvider delayDuration={300}>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <ShellSidebarHeader collapsed={iconOnlySidebar} homeHref={homeHref} />

            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden scrollbar-hide overscroll-contain">
            {!iconOnlySidebar ? (
              <SidebarCollapsedTooltip label="Search" collapsed={false}>
                <button
                  type="button"
                  onClick={() => {
                    setSearchOpen(true)
                    setMobileSidebarOpen(false)
                  }}
                  className={cn("mx-0 mb-1", SIDEBAR_NAV_ROW, magnificSidebarNavItemClass)}
                >
                  <SidebarNavIcon>
                    <Search strokeWidth={1.75} aria-hidden />
                  </SidebarNavIcon>
                  <span className="truncate leading-5">Search</span>
                </button>
              </SidebarCollapsedTooltip>
            ) : (
              <SidebarCollapsedTooltip label="Search" collapsed>
                <button
                  type="button"
                  onClick={() => setSearchOpen(true)}
                  className={cn(
                    "mx-auto mb-1 flex size-9 items-center justify-center",
                    magnificSidebarNavItemClass,
                  )}
                  aria-label="Search"
                >
                  <Search className="size-[18px]" strokeWidth={1.75} />
                </button>
              </SidebarCollapsedTooltip>
            )}

            <div className="min-h-0 flex-1 space-y-0.5">
            {/* Dashboard — regular students only; campers use Dashboard inside Summer Camp group */}
            {!showSummerCampNav && (
              <>
                <NavLink
                  item={dashboardLink}
                  isActive={
                    pathname === dashboardLink.href || pathname === "/student/dashboard-v2"
                  }
                  collapsed={iconOnlySidebar}
                  onNavigate={onNavigate}
                  membershipTier={membershipTier}
                />
                {showMyCourses ? (
                  <NavLink
                    item={MY_COURSES_LINK}
                    isActive={pathname === MY_COURSES_LINK.href}
                    collapsed={iconOnlySidebar}
                    onNavigate={onNavigate}
                    membershipTier={membershipTier}
                  />
                ) : null}
              </>
            )}

            {navGroups.map((group) => (
              <FlatNavSection
                key={group.id}
                group={group}
                pathname={pathname}
                collapsed={iconOnlySidebar}
                onNavigate={onNavigate}
                membershipTier={membershipTier}
              />
            ))}

            {!showSummerCampNav && (
              <>
                <div className="my-2 border-t border-[#EBEBEB] dark:border-[#262626]" aria-hidden />
                <NavLink
                  item={SETTINGS_LINK}
                  isActive={pathname === SETTINGS_LINK.href || pathname.startsWith(SETTINGS_LINK.href + "/")}
                  collapsed={iconOnlySidebar}
                  onNavigate={onNavigate}
                  membershipTier={membershipTier}
                />
                <FlatNavSection
                  group={SUPPORT_GROUP}
                  pathname={pathname}
                  collapsed={iconOnlySidebar}
                  onNavigate={onNavigate}
                  membershipTier={membershipTier}
                />
              </>
            )}
            </div>
            </div>

            <ShellSidebarFooter
              collapsed={iconOnlySidebar}
              userName={studentName}
              planLabel={membershipTier ?? undefined}
              membershipHref="/student/dashboard-v2/membership"
              onMembershipNavigate={onNavigate}
            />
            </div>
          </TooltipProvider>
        </nav>
      </aside>
    </>
  )
}
