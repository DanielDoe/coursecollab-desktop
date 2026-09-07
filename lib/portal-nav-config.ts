/**
 * Portal navigation — grouped IA shared by instructor and admin v2 shells.
 */

import type { LucideIcon } from "lucide-react"
import {
  LayoutDashboard,
  BookOpen,
  ClipboardList,
  UsersRound,
  BarChart3,
  MessageSquare,
  Shield,
  Settings,
  Calendar,
  Presentation,
  Brain,
  Gamepad2,
  FolderKanban,
  Target,
  FileText,
  Library,
  GraduationCap,
  Award,
  CreditCard,
  Clock,
  UserCheck,
  Megaphone,
  Bell,
  Bot,
  HelpCircle,
  DollarSign,
  Activity,
  WifiOff,
  FileCode,
  FilePenLine,
  User,
} from "lucide-react"
import type { PortalKind } from "@/lib/portal-config"
import {
  INSTRUCTOR_DASHBOARD_LINK,
  INSTRUCTOR_NAV_GROUPS,
} from "@/lib/instructor-portal-nav-config"

export type NavItem = {
  id: string
  label: string
  href: string
  icon?: LucideIcon
}

export type NavGroup = {
  id: string
  title: string
  icon: LucideIcon
  items: NavItem[]
}

function path(base: string, segment: string) {
  return `${base}${segment.startsWith("/") ? segment : `/${segment}`}`
}

export function createPortalNav(
  basePath: string,
  options?: { portal?: PortalKind },
): {
  dashboardLink: NavItem
  navGroups: NavGroup[]
} {
  const portal = options?.portal ?? "instructor"
  const dashboardLink: NavItem = {
    id: "dashboard",
    label: "Dashboard",
    href: basePath,
    icon: LayoutDashboard,
  }

  const navGroups: NavGroup[] = [
    {
      id: "course",
      title: "Course",
      icon: BookOpen,
      items: [
        { id: "sessions", label: "Sections", href: path(basePath, "/management/sessions"), icon: Calendar },
        { id: "lectures", label: "Manage Lectures", href: path(basePath, "/content/lectures"), icon: Presentation },
        { id: "practice", label: "Manage Practice", href: path(basePath, "/content/practice"), icon: Brain },
        { id: "playground", label: "Manage Playground", href: path(basePath, "/course/playground"), icon: Gamepad2 },
        { id: "groups", label: "Manage Groups", href: path(basePath, "/management/groups"), icon: FolderKanban },
        { id: "projects", label: "Manage Projects", href: path(basePath, "/management/projects"), icon: Target },
      ],
    },
    {
      id: "assessments",
      title: "Assessments",
      icon: ClipboardList,
      items: [
        { id: "quizzes", label: "Manage Quizzes", href: path(basePath, "/assessments/quizzes"), icon: ClipboardList },
        {
          id: "question-bank",
          label: "Question Bank",
          href: path(basePath, "/assessments/quizzes/question-bank"),
          icon: Library,
        },
        { id: "homeworks", label: "Homework Management", href: path(basePath, "/assessments/homework"), icon: FileText },
        { id: "mid-semester", label: "Mid-Semester Exams", href: path(basePath, "/assessments/mid-semester"), icon: GraduationCap },
        { id: "final-exams", label: "Final Exams", href: path(basePath, "/assessments/finals"), icon: Award },
        { id: "classroom-points", label: "Classroom Points", href: path(basePath, "/assessments/classroom-points"), icon: CreditCard },
        { id: "attendance", label: "Attendance", href: path(basePath, "/assessments/attendance"), icon: UserCheck },
      ],
    },
    {
      id: "students",
      title: "Students",
      icon: UsersRound,
      items: [
        { id: "student-mgmt", label: "Student Management", href: path(basePath, "/management/students"), icon: UsersRound },
        { id: "office-hours", label: "Office Hours", href: path(basePath, "/learning-center/office-hours"), icon: Clock },
        { id: "recommendations", label: "Recommendation Letters", href: path(basePath, "/recommendations/all"), icon: FilePenLine },
        { id: "trade-center", label: "Trade Center", href: path(basePath, "/students/trade-center"), icon: Target },
      ],
    },
    {
      id: "analytics",
      title: "Analytics",
      icon: BarChart3,
      items: [
        { id: "results", label: "Manage Results", href: path(basePath, "/results"), icon: BarChart3 },
        { id: "advanced-analytics", label: "Advanced Analytics", href: path(basePath, "/analytics/advanced"), icon: Activity },
        { id: "reports", label: "Reports", href: path(basePath, "/analytics/reports"), icon: FileCode },
      ],
    },
    {
      id: "communication",
      title: "Communication",
      icon: MessageSquare,
      items: [
        { id: "announcements", label: "Announcements", href: path(basePath, "/communication/announcements"), icon: Megaphone },
        { id: "notifications", label: "Notifications", href: path(basePath, "/communication/notifications"), icon: Bell },
        { id: "help-center", label: "Help Center", href: path(basePath, "/learning-center/help"), icon: HelpCircle },
      ],
    },
    {
      id: "settings",
      title: "Settings",
      icon: Settings,
      items: [
        { id: "settings", label: "Settings", href: path(basePath, "/settings"), icon: Settings },
      ],
    },
  ]

  if (portal === "instructor") {
    return { dashboardLink: INSTRUCTOR_DASHBOARD_LINK, navGroups: INSTRUCTOR_NAV_GROUPS }
  }

  return { dashboardLink, navGroups }
}

export function isGroupActive(group: NavGroup, pathname: string): boolean {
  for (const item of group.items) {
    const itemPath = item.href.split("?")[0]
    if (pathname === itemPath || pathname.startsWith(itemPath + "/")) return true
  }
  return false
}

export function isItemActive(
  item: NavItem,
  pathname: string,
  basePath: string,
  currentSearch = "",
): boolean {
  const qIndex = item.href.indexOf("?")
  const itemPath = qIndex === -1 ? item.href : item.href.slice(0, qIndex)
  const itemQuery = qIndex === -1 ? "" : item.href.slice(qIndex + 1)

  const pathMatches =
    itemPath === basePath
      ? pathname === itemPath || pathname === basePath
      : pathname === itemPath || pathname.startsWith(itemPath + "/")

  if (!pathMatches) return false

  if (!itemQuery) return true

  const itemParams = new URLSearchParams(itemQuery)
  const currentParams = new URLSearchParams(currentSearch)

  let currentSection = currentParams.get("section")
  if (currentSection === "analytics") currentSection = "student-progress"

  for (const [key, value] of itemParams.entries()) {
    if (key === "section" && !currentParams.get("section")) {
      if (value === "results") continue
      return false
    }
    const currentVal = key === "section" ? currentSection : currentParams.get(key)
    if (currentVal !== value) return false
  }

  return true
}
