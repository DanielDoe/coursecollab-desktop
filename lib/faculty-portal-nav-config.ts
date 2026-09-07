/**
 * Faculty portal navigation — every item declares required permission(s), not role names.
 */

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
  CalendarClock,
  CalendarDays,
  Presentation,
  Brain,
  Layers,
  Gamepad2,
  FolderKanban,
  Target,
  FileText,
  Library,
  GraduationCap,
  Award,
  Clock,
  UserCheck,
  Megaphone,
  Bell,
  Mail,
  Bot,
  HelpCircle,
  FilePenLine,
  Sliders,
  Scale,
  Sparkles,
  Users,
  AlertCircle,
  User,
  MessageCircle,
  Sun,
  ScrollText,
  ClipboardCheck,
  CreditCard,
  Share2,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type { NavGroup, NavItem } from "@/lib/portal-nav-config"
import { hasAnyPermission } from "@/lib/permission-utils"

export const FACULTY_DASHBOARD_BASE = "/faculty/dashboard"

export const FACULTY_MEMBERSHIP_HREF = `${FACULTY_DASHBOARD_BASE}/membership`

export type FacultyNavItemDef = NavItem & {
  /** User must have at least one of these permissions (empty = always show, e.g. dashboard). */
  requiredPermissions?: string[]
}

export type FacultyNavGroupDef = {
  id: string
  title: string
  icon: LucideIcon
  items: FacultyNavItemDef[]
}

function p(segment: string) {
  return `${FACULTY_DASHBOARD_BASE}${segment.startsWith("/") ? segment : `/${segment}`}`
}

export const FACULTY_DASHBOARD_LINK: FacultyNavItemDef = {
  id: "dashboard",
  label: "Dashboard",
  href: FACULTY_DASHBOARD_BASE,
  icon: LayoutDashboard,
}

/** Master registry — filtered at runtime by getUserCoursePermissions(). */
export const FACULTY_NAV_REGISTRY: FacultyNavGroupDef[] = [
  {
    id: "course",
    title: "Course",
    icon: BookOpen,
    items: [
      { id: "my-courses", label: "My Courses", href: p("/administration/my-courses"), icon: BookOpen },
      { id: "sections", label: "Academic Terms", href: p("/management/sessions"), icon: Calendar, requiredPermissions: ["manage_sections"] },
      { id: "calendar", label: "Calendar", href: p("/calendar"), icon: CalendarDays },
      { id: "announcements", label: "Announcements", href: p("/communication/announcements"), icon: Megaphone, requiredPermissions: ["publish_announcements", "draft_announcements", "view_course_content"] },
      { id: "syllabus", label: "Syllabus", href: p("/content/syllabus"), icon: ScrollText, requiredPermissions: ["manage_syllabus", "manage_course_settings", "view_course_content"] },
      { id: "lectures", label: "Manage Lectures", href: p("/content/lectures"), icon: Presentation, requiredPermissions: ["manage_lectures", "view_course_content"] },
      { id: "practice", label: "Manage Practice", href: p("/content/practice"), icon: Brain, requiredPermissions: ["manage_practice_content", "view_course_content"] },
      { id: "flashcards", label: "Flashcards", href: p("/content/flashcards"), icon: Layers, requiredPermissions: ["manage_practice_content", "view_course_content"] },
      { id: "course-notes", label: "Course Notes", href: p("/content/notes"), icon: FilePenLine, requiredPermissions: ["manage_practice_content", "view_course_content"] },
      { id: "cora-copilot", label: "Cora Copilot", href: p("/cora"), icon: Sparkles, requiredPermissions: ["edit_quizzes", "publish_quizzes", "manage_practice_content", "view_course_content", "manage_course_settings"] },
      { id: "playground", label: "Manage Playground", href: p("/course/playground"), icon: Gamepad2, requiredPermissions: ["manage_playground", "view_course_content"] },
      { id: "groups", label: "Manage Groups", href: p("/management/groups"), icon: FolderKanban, requiredPermissions: ["manage_groups"] },
      { id: "projects", label: "Manage Projects", href: p("/management/projects"), icon: Target, requiredPermissions: ["manage_projects"] },
      { id: "course-exchange", label: "Course Exchange", href: p("/course/exchange"), icon: Share2, requiredPermissions: ["manage_course_settings"] },
      { id: "summer-camp", label: "Summer Camp", href: p("/summer-camp"), icon: Sun },
    ],
  },
  {
    id: "assessments",
    title: "Assessments",
    icon: ClipboardList,
    items: [
      { id: "quizzes", label: "Manage Quizzes", href: p("/assessments/quizzes"), icon: ClipboardList, requiredPermissions: ["edit_quizzes", "publish_quizzes", "grade_exams", "grade_assignments", "review_submissions", "view_assessments"] },
      { id: "question-bank", label: "Question Bank", href: p("/assessments/quizzes/question-bank"), icon: Library, requiredPermissions: ["edit_quizzes", "publish_quizzes", "grade_exams", "grade_assignments", "review_submissions", "view_assessments"] },
      { id: "homeworks", label: "Manage Homework", href: p("/assessments/homework"), icon: FileText, requiredPermissions: ["edit_homework", "publish_homework", "grade_assignments", "review_submissions", "view_assessments"] },
      { id: "mid-semester", label: "Mid-Semester Exams", href: p("/assessments/mid-semester"), icon: GraduationCap, requiredPermissions: ["edit_quizzes", "publish_quizzes", "grade_exams", "grade_assignments", "review_submissions", "view_assessments"] },
      { id: "final-exams", label: "Final Exams", href: p("/assessments/finals"), icon: Award, requiredPermissions: ["edit_quizzes", "publish_quizzes", "grade_exams", "grade_assignments", "review_submissions", "view_assessments"] },
      { id: "classroom-points", label: "Classroom Points", href: p("/assessments/classroom-points"), icon: Sparkles, requiredPermissions: ["manage_classroom_points", "publish_classroom_points", "manage_course_settings"] },
      { id: "course-evaluations", label: "Course Evaluations", href: p("/assessments/course-evaluations"), icon: ClipboardCheck, requiredPermissions: ["manage_course_settings", "grade_assignments", "review_submissions"] },
      { id: "attendance", label: "Attendance", href: p("/assessments/attendance"), icon: UserCheck, requiredPermissions: ["take_attendance", "manage_attendance"] },
    ],
  },
  {
    id: "students",
    title: "Students",
    icon: UsersRound,
    items: [
      { id: "student-mgmt", label: "Student Directory", href: p("/management/students"), icon: UsersRound, requiredPermissions: ["manage_students", "view_analytics"] },
      { id: "campers", label: "Campers", href: p("/campers"), icon: Sun },
      { id: "office-hours", label: "Office Hours", href: p("/learning-center/office-hours"), icon: Clock, requiredPermissions: ["hold_office_hours"] },
      { id: "recommendations", label: "Recommendation Letters", href: p("/recommendations/all"), icon: FilePenLine, requiredPermissions: ["manage_course_settings"] },
      { id: "trade-center", label: "Trade Center", href: p("/students/trade-center"), icon: Target, requiredPermissions: ["manage_course_settings"] },
    ],
  },
  {
    id: "analytics",
    title: "Analytics",
    icon: BarChart3,
    items: [
      { id: "results", label: "Manage Results", href: p("/analytics?section=results"), icon: ClipboardList, requiredPermissions: ["view_analytics"] },
      { id: "advanced-analytics", label: "Student Progress", href: p("/analytics?section=student-progress"), icon: BarChart3, requiredPermissions: ["view_analytics"] },
      { id: "reports", label: "Manage Reports", href: p("/analytics?section=reports"), icon: FileText, requiredPermissions: ["view_analytics"] },
      { id: "progress-reviews", label: "Progress Reviews", href: p("/analytics?section=progress-reviews"), icon: Sparkles, requiredPermissions: ["view_analytics"] },
    ],
  },
  {
    id: "communication",
    title: "Communication",
    icon: MessageSquare,
    items: [
      { id: "notifications", label: "Notifications", href: p("/communication/notifications"), icon: Bell, requiredPermissions: ["draft_announcements", "publish_announcements"] },
      { id: "messages", label: "Messages", href: p("/communication/messages"), icon: Mail },
      { id: "discussions", label: "Course Discussions", href: p("/communication/discussions"), icon: MessageCircle, requiredPermissions: ["moderate_discussions"] },
      { id: "help-center", label: "Student Support", href: p("/learning-center/help"), icon: HelpCircle, requiredPermissions: ["moderate_discussions", "view_analytics"] },
    ],
  },
  {
    id: "course-administration",
    title: "Administration",
    icon: Shield,
    items: [
      { id: "course-settings", label: "Course Settings", href: p("/administration/course-settings"), icon: Sliders, requiredPermissions: ["manage_course_settings"] },
      { id: "schedule-adjustment", label: "Schedule Adjustment", href: p("/administration/schedule-adjustment"), icon: CalendarClock, requiredPermissions: ["manage_course_settings"] },
      { id: "assessment-governance", label: "Assessment Governance", href: p("/administration/assessment-governance"), icon: Shield, requiredPermissions: ["manage_course_settings"] },
      { id: "assessment-defaults", label: "Assessment Defaults", href: p("/administration/assessment-defaults"), icon: ClipboardList, requiredPermissions: ["manage_course_settings"] },
      { id: "grading-policies", label: "Grading Policies", href: p("/administration/grading-policies"), icon: Scale, requiredPermissions: ["manage_course_settings"] },
      { id: "attendance-policies", label: "Attendance Policies", href: p("/administration/attendance-policies"), icon: UserCheck, requiredPermissions: ["manage_course_settings"] },
      { id: "classroom-points-rules", label: "Classroom Points Rules", href: p("/administration/classroom-points-rules"), icon: Sparkles, requiredPermissions: ["manage_course_settings"] },
      { id: "practice-rules", label: "Practice Hub Rules", href: p("/administration/practice-rules"), icon: Brain, requiredPermissions: ["manage_course_settings"] },
      { id: "playground-rules", label: "Playground Rules", href: p("/administration/playground-rules"), icon: Gamepad2, requiredPermissions: ["manage_course_settings", "manage_playground"] },
      { id: "ai-assistant-settings", label: "Cora Assistant Settings", href: p("/administration/ai-assistant-settings"), icon: Bot, requiredPermissions: ["manage_course_settings"] },
      { id: "team-project-policies", label: "Team & Project Policies", href: p("/administration/team-project-policies"), icon: Users, requiredPermissions: ["manage_course_settings"] },
      { id: "submission-issues", label: "Submission Issues", href: p("/administration/submission-issues"), icon: AlertCircle, requiredPermissions: ["manage_course_settings", "review_submissions"] },
      { id: "teaching-assistants", label: "Teaching Assistants", href: p("/administration/teaching-assistants"), icon: Users, requiredPermissions: ["manage_tas"] },
    ],
  },
  {
    id: "settings",
    title: "Settings",
    icon: Settings,
    items: [
      { id: "settings", label: "Settings", href: p("/settings"), icon: Settings },
      { id: "membership", label: "Instructor Plans", href: FACULTY_MEMBERSHIP_HREF, icon: CreditCard },
    ],
  },
]

function buildFacultyNavGroups(
  includeItem: (item: FacultyNavItemDef) => boolean,
): NavGroup[] {
  const navGroups: NavGroup[] = []

  for (const group of FACULTY_NAV_REGISTRY) {
    const items: NavItem[] = []
    for (const item of group.items) {
      if (!includeItem(item)) continue
      items.push({
        id: item.id,
        label: item.label,
        href: item.href,
        icon: item.icon,
      })
    }
    if (items.length > 0) {
      items.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }))
      navGroups.push({
        id: group.id,
        title: group.title,
        icon: group.icon,
        items,
      })
    }
  }

  return navGroups
}

/** Full faculty sidebar when no course is selected (skip flow). */
export function buildFacultyNavFull(): {
  dashboardLink: NavItem
  navGroups: NavGroup[]
} {
  return {
    dashboardLink: FACULTY_DASHBOARD_LINK,
    navGroups: buildFacultyNavGroups(() => true),
  }
}

export function buildFacultyNavFromPermissions(permissions: string[]): {
  dashboardLink: NavItem
  navGroups: NavGroup[]
} {
  return {
    dashboardLink: FACULTY_DASHBOARD_LINK,
    navGroups: buildFacultyNavGroups((item) => {
      const required = item.requiredPermissions
      return !required || required.length === 0 || hasAnyPermission(permissions, required)
    }),
  }
}

/** Route prefixes that always require explicit permissions (never open by default). */
export const FACULTY_PROTECTED_ROUTE_PERMISSIONS: { prefix: string; permissions: string[] }[] = [
  { prefix: "/faculty/dashboard/administration", permissions: ["manage_course_settings", "manage_tas", "review_submissions"] },
  { prefix: "/faculty/dashboard/students/trade-center", permissions: ["manage_course_settings"] },
  { prefix: "/faculty/dashboard/assessments/attendance", permissions: ["take_attendance", "manage_attendance"] },
  { prefix: "/faculty/dashboard/assessments/mid-semester", permissions: ["edit_quizzes", "publish_quizzes", "grade_exams", "grade_assignments", "review_submissions", "view_assessments"] },
  { prefix: "/faculty/dashboard/assessments/finals", permissions: ["edit_quizzes", "publish_quizzes", "grade_exams", "grade_assignments", "review_submissions", "view_assessments"] },
  { prefix: "/faculty/dashboard/assessments/classroom-points", permissions: ["manage_classroom_points", "publish_classroom_points", "manage_course_settings"] },
  { prefix: "/faculty/dashboard/assessments/course-evaluations", permissions: ["manage_course_settings", "grade_assignments", "review_submissions"] },
]

export function isFacultyRouteAllowed(pathname: string, permissions: string[]): boolean {
  if (!pathname.startsWith(FACULTY_DASHBOARD_BASE)) return true
  const relative = pathname.slice(FACULTY_DASHBOARD_BASE.length) || "/"
  if (relative === "/" || relative === "") return true

  // Always available — course creation/management without an active course scope
  if (relative === "/administration/my-courses" || relative.startsWith("/administration/my-courses/")) {
    return true
  }

  for (const { prefix, permissions: required } of FACULTY_PROTECTED_ROUTE_PERMISSIONS) {
    if (pathname === prefix || pathname.startsWith(prefix + "/")) {
      return hasAnyPermission(permissions, required)
    }
  }

  for (const group of FACULTY_NAV_REGISTRY) {
    for (const item of group.items) {
      const itemPath = item.href.split("?")[0]
      if (pathname === itemPath || pathname.startsWith(itemPath + "/")) {
        const required = item.requiredPermissions
        if (!required || required.length === 0) return true
        return hasAnyPermission(permissions, required)
      }
    }
  }

  return true
}

export { courseStaffRoleLabel as staffRoleLabel } from "@/lib/roles"
