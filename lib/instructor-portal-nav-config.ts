/**
 * Instructor portal navigation — course delivery & policies (no platform admin).
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
  Bot,
  HelpCircle,
  FilePenLine,
  Sliders,
  Scale,
  Sparkles,
  Users,
  AlertCircle,
  Activity,
  Share2,
  CreditCard,
} from "lucide-react"
import type { NavGroup, NavItem } from "@/lib/portal-nav-config"

export const INSTRUCTOR_DASHBOARD_V2_BASE = "/faculty/dashboard"

export const INSTRUCTOR_MEMBERSHIP_HREF = `${INSTRUCTOR_DASHBOARD_V2_BASE}/membership`

function p(segment: string) {
  return `${INSTRUCTOR_DASHBOARD_V2_BASE}${segment.startsWith("/") ? segment : `/${segment}`}`
}

export const INSTRUCTOR_DASHBOARD_LINK: NavItem = {
  id: "dashboard",
  label: "Dashboard",
  href: INSTRUCTOR_DASHBOARD_V2_BASE,
  icon: LayoutDashboard,
}

export const INSTRUCTOR_NAV_GROUPS: NavGroup[] = [
  {
    id: "course",
    title: "Course",
    icon: BookOpen,
    items: [
      { id: "sessions", label: "Academic Terms", href: p("/management/sessions"), icon: Calendar },
      { id: "calendar", label: "Calendar", href: p("/calendar"), icon: CalendarDays },
      { id: "lectures", label: "Manage Lectures", href: p("/content/lectures"), icon: Presentation },
      { id: "practice", label: "Manage Practice", href: p("/content/practice"), icon: Brain },
      { id: "flashcards", label: "Flashcards", href: p("/content/flashcards"), icon: Layers },
      { id: "course-notes", label: "Course Notes", href: p("/content/notes"), icon: FilePenLine },
      { id: "cora-copilot", label: "Cora Copilot", href: p("/cora"), icon: Sparkles },
      { id: "playground", label: "Manage Playground", href: p("/course/playground"), icon: Gamepad2 },
      { id: "groups", label: "Manage Groups", href: p("/management/groups"), icon: FolderKanban },
      { id: "projects", label: "Manage Projects", href: p("/management/projects"), icon: Target },
      { id: "course-exchange", label: "Course Exchange", href: p("/course/exchange"), icon: Share2 },
    ],
  },
  {
    id: "assessments",
    title: "Assessments",
    icon: ClipboardList,
    items: [
      { id: "quizzes", label: "Manage Quizzes", href: p("/assessments/quizzes"), icon: ClipboardList },
      {
        id: "question-bank",
        label: "Question Bank",
        href: p("/assessments/quizzes/question-bank"),
        icon: Library,
      },
      { id: "homeworks", label: "Homework Management", href: p("/assessments/homework"), icon: FileText },
      { id: "mid-semester", label: "Mid-Semester Exams", href: p("/assessments/mid-semester"), icon: GraduationCap },
      { id: "final-exams", label: "Final Exams", href: p("/assessments/finals"), icon: Award },
      { id: "classroom-points", label: "Classroom Points", href: p("/assessments/classroom-points"), icon: Sparkles },
      { id: "attendance", label: "Attendance", href: p("/assessments/attendance"), icon: UserCheck },
      { id: "grades", label: "Grades Management", href: p("/assessments/grades"), icon: GraduationCap },
    ],
  },
  {
    id: "students",
    title: "Students",
    icon: UsersRound,
    items: [
      { id: "student-mgmt", label: "Student Management", href: p("/management/students"), icon: UsersRound },
      { id: "office-hours", label: "Office Hours", href: p("/learning-center/office-hours"), icon: Clock },
      { id: "recommendations", label: "Recommendation Letters", href: p("/recommendations/all"), icon: FilePenLine },
      { id: "trade-center", label: "Trade Center", href: p("/students/trade-center"), icon: Target },
    ],
  },
  {
    id: "analytics",
    title: "Analytics",
    icon: BarChart3,
    items: [
      { id: "results", label: "Manage Results", href: p("/results"), icon: BarChart3 },
      { id: "advanced-analytics", label: "Advanced Analytics", href: p("/analytics/advanced"), icon: BarChart3 },
      { id: "reports", label: "Reports", href: p("/analytics/reports"), icon: FileText },
      { id: "progress-reviews", label: "Progress Reviews", href: p("/analytics/progress-reviews"), icon: Sparkles },
      { id: "ai-monitoring", label: "AI Monitoring", href: p("/analytics/ai-monitoring"), icon: Activity },
      { id: "ai-insights", label: "AI Insights", href: p("/analytics/ai-insights"), icon: Bot },
    ],
  },
  {
    id: "communication",
    title: "Communication",
    icon: MessageSquare,
    items: [
      { id: "announcements", label: "Announcements", href: p("/communication/announcements"), icon: Megaphone },
      { id: "notifications", label: "Notifications", href: p("/communication/notifications"), icon: Bell },
      { id: "help-center", label: "Help Center", href: p("/learning-center/help"), icon: HelpCircle },
    ],
  },
  {
    id: "course-administration",
    title: "Administration",
    icon: Shield,
    items: [
      { id: "course-settings", label: "Course Settings", href: p("/administration/course-settings"), icon: Sliders },
      {
        id: "assessment-governance",
        label: "Assessment Governance",
        href: p("/administration/assessment-governance"),
        icon: Shield,
      },
      { id: "grading-policies", label: "Grading Policies", href: p("/administration/grading-policies"), icon: Scale },
      {
        id: "attendance-policies",
        label: "Attendance Policies",
        href: p("/administration/attendance-policies"),
        icon: UserCheck,
      },
      {
        id: "classroom-points-rules",
        label: "Classroom Points Rules",
        href: p("/administration/classroom-points-rules"),
        icon: Sparkles,
      },
      {
        id: "practice-rules",
        label: "Practice Hub Rules",
        href: p("/administration/practice-rules"),
        icon: Brain,
      },
      {
        id: "playground-rules",
        label: "Playground Rules",
        href: p("/administration/playground-rules"),
        icon: Gamepad2,
      },
      {
        id: "ai-assistant-settings",
        label: "Cora Assistant Settings",
        href: p("/administration/ai-assistant-settings"),
        icon: Bot,
      },
      {
        id: "team-project-policies",
        label: "Team & Project Policies",
        href: p("/administration/team-project-policies"),
        icon: Users,
      },
      {
        id: "submission-issues",
        label: "Submission Issues",
        href: p("/administration/submission-issues"),
        icon: AlertCircle,
      },
      {
        id: "teaching-assistants",
        label: "Teaching Assistants",
        href: p("/administration/teaching-assistants"),
        icon: Users,
      },
    ],
  },
  {
    id: "settings",
    title: "Settings",
    icon: Settings,
    items: [
      { id: "settings", label: "Settings", href: p("/settings"), icon: Settings },
      { id: "membership", label: "Instructor Plans", href: p("/membership"), icon: CreditCard },
    ],
  },
]

export function isInstructorGroupActive(group: NavGroup, pathname: string): boolean {
  for (const item of group.items) {
    const itemPath = item.href.split("?")[0]
    if (pathname === itemPath || pathname.startsWith(itemPath + "/")) return true
  }
  return false
}

export function isInstructorItemActive(item: NavItem, pathname: string): boolean {
  const itemPath = item.href.split("?")[0]
  if (itemPath === INSTRUCTOR_DASHBOARD_V2_BASE) {
    return pathname === itemPath || pathname === INSTRUCTOR_DASHBOARD_V2_BASE + "/"
  }
  return pathname === itemPath || pathname.startsWith(itemPath + "/")
}
