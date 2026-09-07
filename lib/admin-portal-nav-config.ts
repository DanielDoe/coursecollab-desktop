/**
 * Admin portal navigation — institution management (not course delivery).
 */

import {
  LayoutDashboard,
  UserCog,
  UsersRound,
  Shield,
  BookOpen,
  GraduationCap,
  DollarSign,
  MessageSquare,
  BarChart3,
  Activity,
  Settings,
  User,
  Calendar,
  UserPlus,
  Library,
  FileSearch,
  Scale,
  Briefcase,
  Megaphone,
  Radio,
  TrendingUp,
  FileCode,
  Flag,
  Lock,
  Database,
  WifiOff,
  CreditCard,
  AlertTriangle,
  KeyRound,
  Link2,
  Sun,
  Zap,
  Building2,
} from "lucide-react"
import type { NavGroup, NavItem } from "@/lib/portal-nav-config"

const BASE = "/admin/dashboard-v2"

function p(segment: string) {
  return `${BASE}${segment.startsWith("/") ? segment : `/${segment}`}`
}

export const ADMIN_DASHBOARD_LINK: NavItem = {
  id: "dashboard",
  label: "Dashboard",
  href: BASE,
  icon: LayoutDashboard,
}

export const ADMIN_NAV_GROUPS: NavGroup[] = [
  {
    id: "users",
    title: "Users",
    icon: UsersRound,
    items: [
      { id: "faculty", label: "Faculty", href: p("/management/faculty"), icon: UserCog },
      { id: "students", label: "Students", href: p("/management/students"), icon: UsersRound },
      { id: "campers", label: "Campers", href: p("/campers"), icon: Sun },
      { id: "roles", label: "Roles & Permissions", href: p("/administration/roles-permissions"), icon: Shield },
      { id: "accounts", label: "Account Management", href: p("/users/account-management"), icon: KeyRound },
      { id: "institutions", label: "Institutions", href: p("/institutions"), icon: Building2 },
    ],
  },
  {
    id: "courses",
    title: "Courses",
    icon: BookOpen,
    items: [
      { id: "catalog", label: "Course Catalog", href: p("/courses/catalog"), icon: Library },
      { id: "sections", label: "Sections", href: p("/management/sessions"), icon: Calendar },
      { id: "enrollment", label: "Enrollment Management", href: p("/management/students"), icon: UserPlus },
      { id: "semester", label: "Semester Management", href: p("/management/sessions"), icon: Calendar },
      { id: "assignments", label: "Course Assignments", href: p("/courses/assignments"), icon: Link2 },
      { id: "summer-camp", label: "Summer Camp", href: p("/summer-camp"), icon: Sun },
    ],
  },
  {
    id: "academic",
    title: "Academic Affairs",
    icon: GraduationCap,
    items: [
      { id: "course-oversight", label: "Course Oversight", href: p("/academic/course-oversight"), icon: BarChart3 },
      { id: "assessment-audits", label: "Assessment Audits", href: p("/academic/assessment-audits"), icon: FileSearch },
      { id: "integrity", label: "Academic Integrity", href: p("/academic/integrity"), icon: Scale },
      { id: "faculty-workload", label: "Faculty Workload", href: p("/academic/faculty-workload"), icon: Briefcase },
    ],
  },
  {
    id: "finance",
    title: "Finance",
    icon: DollarSign,
    items: [
      { id: "revenue", label: "Revenue", href: p("/administration/financials"), icon: DollarSign },
      { id: "billing", label: "Billing", href: p("/finance/billing"), icon: CreditCard },
      { id: "cora-costs", label: "Cora Cost Center", href: p("/finance/cora-costs"), icon: Zap },
      { id: "institutional-pricing", label: "Institutional Pricing", href: p("/finance/institutional-pricing"), icon: Building2 },
      { id: "payroll", label: "Payroll", href: p("/finance/payroll"), icon: Briefcase },
      { id: "scholarships", label: "Scholarships", href: p("/finance/scholarships"), icon: GraduationCap },
      { id: "financial-reports", label: "Financial Reports", href: p("/finance/reports"), icon: FileCode },
    ],
  },
  {
    id: "communication",
    title: "Communication",
    icon: MessageSquare,
    items: [
      { id: "announcements", label: "Global Announcements", href: p("/communication/announcements"), icon: Megaphone },
      { id: "broadcast", label: "Broadcast Center", href: p("/communication/broadcast"), icon: Radio },
      {
        id: "emergency",
        label: "Emergency Notifications",
        href: p("/communication/emergency"),
        icon: AlertTriangle,
      },
    ],
  },
  {
    id: "analytics",
    title: "Analytics",
    icon: BarChart3,
    items: [
      { id: "enrollment-analytics", label: "Enrollment Analytics", href: p("/analytics/enrollment"), icon: TrendingUp },
      { id: "student-success", label: "Student Success", href: p("/analytics/student-success"), icon: UsersRound },
      { id: "faculty-analytics", label: "Faculty Analytics", href: p("/analytics/faculty"), icon: UserCog },
      { id: "institutional-reports", label: "Institutional Reports", href: p("/analytics/reports"), icon: FileCode },
    ],
  },
  {
    id: "system",
    title: "System",
    icon: Activity,
    items: [
      { id: "system-monitor", label: "System Monitor", href: p("/administration/system-monitor"), icon: Activity },
      {
        id: "submission-diagnostics",
        label: "Submission Diagnostics",
        href: p("/administration/submission-diagnostics"),
        icon: WifiOff,
      },
      { id: "system-logs", label: "System Logs", href: p("/administration/logs"), icon: AlertTriangle },
      { id: "audit-logs", label: "Audit Logs", href: p("/administration/audit-logs"), icon: FileCode },
      { id: "security", label: "Security Center", href: p("/administration/security"), icon: Lock },
      { id: "platform-config", label: "Platform Configuration", href: p("/administration/platform-config"), icon: Database },
      { id: "feature-flags", label: "Feature Flags", href: p("/administration/feature-flags"), icon: Flag },
    ],
  },
  {
    id: "settings",
    title: "Settings",
    icon: Settings,
    items: [
      { id: "profile", label: "Profile", href: p("/settings/profile"), icon: User },
      { id: "organization", label: "Organization Settings", href: p("/settings/organization"), icon: Settings },
    ],
  },
]

export function isAdminGroupActive(group: NavGroup, pathname: string): boolean {
  for (const item of group.items) {
    const pathOnly = item.href.split("?")[0]
    if (pathname === pathOnly || pathname.startsWith(pathOnly + "/")) return true
  }
  return false
}

export function isAdminItemActive(item: NavItem, pathname: string): boolean {
  const pathOnly = item.href.split("?")[0]
  if (pathOnly === BASE) {
    return pathname === BASE || pathname === BASE + "/"
  }
  return pathname === pathOnly || pathname.startsWith(pathOnly + "/")
}
