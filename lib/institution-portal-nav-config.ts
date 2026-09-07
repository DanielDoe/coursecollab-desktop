import {
  LayoutDashboard,
  FileText,
  GraduationCap,
  Users,
  BookOpen,
  Network,
  Sparkles,
  BarChart3,
  CreditCard,
  Settings,
  Building2,
} from "lucide-react"
import type { NavGroup, NavItem } from "@/lib/portal-nav-config"

export const INSTITUTION_DASHBOARD_BASE = "/institution/dashboard"

export const INSTITUTION_DASHBOARD_LINK: NavItem = {
  id: "dashboard",
  label: "Dashboard",
  href: INSTITUTION_DASHBOARD_BASE,
  icon: LayoutDashboard,
}

export const INSTITUTION_NAV_GROUPS: NavGroup[] = [
  {
    id: "institution",
    title: "Institution",
    icon: Building2,
    items: [
      { id: "license", label: "License", href: `${INSTITUTION_DASHBOARD_BASE}/license`, icon: FileText },
      { id: "organization", label: "Organization", href: `${INSTITUTION_DASHBOARD_BASE}/organization`, icon: Network },
    ],
  },
  {
    id: "academic",
    title: "Academic",
    icon: GraduationCap,
    items: [
      { id: "faculty", label: "Faculty", href: `${INSTITUTION_DASHBOARD_BASE}/faculty`, icon: GraduationCap },
      { id: "students", label: "Students", href: `${INSTITUTION_DASHBOARD_BASE}/students`, icon: Users },
      { id: "courses", label: "Courses", href: `${INSTITUTION_DASHBOARD_BASE}/courses`, icon: BookOpen },
    ],
  },
  {
    id: "intelligence",
    title: "Intelligence",
    icon: Sparkles,
    items: [
      { id: "cora", label: "Cora Usage", href: `${INSTITUTION_DASHBOARD_BASE}/cora`, icon: Sparkles },
      { id: "analytics", label: "Analytics", href: `${INSTITUTION_DASHBOARD_BASE}/analytics`, icon: BarChart3 },
    ],
  },
  {
    id: "administration",
    title: "Administration",
    icon: CreditCard,
    items: [
      { id: "billing", label: "Billing", href: `${INSTITUTION_DASHBOARD_BASE}/billing`, icon: CreditCard },
      { id: "invoices", label: "Invoices", href: `${INSTITUTION_DASHBOARD_BASE}/invoices`, icon: FileText },
      { id: "settings", label: "Settings", href: `${INSTITUTION_DASHBOARD_BASE}/settings`, icon: Settings },
    ],
  },
]

export const INSTITUTION_PORTAL_MARK = {
  label: "Institution",
  icon: Building2,
}
