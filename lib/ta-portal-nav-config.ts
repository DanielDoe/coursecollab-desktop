/**
 * TA portal navigation — course support & assistance (no policy administration).
 */

import {
  LayoutDashboard,
  BookOpen,
  ClipboardList,
  UsersRound,
  MessageSquare,
  BarChart3,
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
  Clock,
  UserCheck,
  Megaphone,
  Bell,
  MessageCircle,
  User,
  HelpCircle,
} from "lucide-react"
import type { NavGroup, NavItem } from "@/lib/portal-nav-config"

/** @deprecated Use faculty portal — TA nav is permission-driven via FACULTY_NAV_REGISTRY */
export const TA_DASHBOARD_V2_BASE = "/faculty/dashboard"

function p(segment: string) {
  return `${TA_DASHBOARD_V2_BASE}${segment.startsWith("/") ? segment : `/${segment}`}`
}

export const TA_DASHBOARD_LINK: NavItem = {
  id: "dashboard",
  label: "Dashboard",
  href: TA_DASHBOARD_V2_BASE,
  icon: LayoutDashboard,
}

export const TA_NAV_GROUPS: NavGroup[] = [
  {
    id: "course-support",
    title: "Course Support",
    icon: BookOpen,
    items: [
      { id: "sections", label: "Sections", href: p("/management/sessions"), icon: Calendar },
      { id: "lectures", label: "Lectures", href: p("/content/lectures"), icon: Presentation },
      { id: "practice", label: "Practice", href: p("/content/practice"), icon: Brain },
      { id: "playground", label: "Playground", href: p("/course/playground"), icon: Gamepad2 },
      { id: "groups", label: "Groups", href: p("/management/groups"), icon: FolderKanban },
      { id: "projects", label: "Projects", href: p("/management/projects"), icon: Target },
    ],
  },
  {
    id: "assessments",
    title: "Assessments",
    icon: ClipboardList,
    items: [
      { id: "quiz-assist", label: "Quiz Assistance", href: p("/assessments/quizzes"), icon: ClipboardList },
      {
        id: "question-bank",
        label: "Question Bank",
        href: p("/assessments/quizzes/question-bank"),
        icon: Library,
      },
      { id: "homework-assist", label: "Homework Assistance", href: p("/assessments/homework"), icon: FileText },
    ],
  },
  {
    id: "students",
    title: "Students",
    icon: UsersRound,
    items: [
      { id: "directory", label: "Student Directory", href: p("/management/students"), icon: UsersRound },
      { id: "office-hours", label: "Office Hours", href: p("/learning-center/office-hours"), icon: Clock },
      { id: "student-support", label: "Student Support", href: p("/learning-center/help"), icon: HelpCircle },
      { id: "attendance", label: "Attendance Management", href: p("/assessments/attendance"), icon: UserCheck },
    ],
  },
  {
    id: "communication",
    title: "Communication",
    icon: MessageSquare,
    items: [
      { id: "announcements", label: "Announcements", href: p("/communication/announcements"), icon: Megaphone },
      { id: "notifications", label: "Notifications", href: p("/communication/notifications"), icon: Bell },
      {
        id: "discussions",
        label: "Course Discussions",
        href: p("/communication/discussions"),
        icon: MessageCircle,
      },
    ],
  },
  {
    id: "analytics",
    title: "Analytics",
    icon: BarChart3,
    items: [
      { id: "course-analytics", label: "Manage Results", href: p("/results"), icon: BarChart3 },
      { id: "student-progress", label: "Class Analytics", href: p("/analytics/advanced"), icon: GraduationCap },
    ],
  },
  {
    id: "settings",
    title: "Settings",
    icon: Settings,
    items: [{ id: "settings", label: "Settings", href: p("/settings"), icon: Settings }],
  },
]
