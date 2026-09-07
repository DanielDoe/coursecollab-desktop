import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"
import {
  LayoutDashboard,
  FilePenLine,
  PlusCircle,
  Sparkles,
  Coins,
  Mail,
  Settings,
  FileText,
  Zap,
  Bug,
  HelpCircle,
  Send,
  Wand2,
} from "lucide-react"
import { CoraSidebarMark } from "@/components/cora/CoraLogo"
import { GUEST_CORA_SIDEBAR_LABEL } from "@/lib/cora/constants"
import type { GuestCapability } from "@/lib/guest/types"
import { guestHasCapability } from "@/lib/guest/capabilities"

export type GuestNavItem = {
  id: string
  label: string
  href: string
  icon: LucideIcon | typeof CoraSidebarMark
  capability?: GuestCapability
  /** Show only when user lacks Cora Career */
  showWhenFreeOnly?: boolean
}

export type GuestNavGroup = {
  id: string
  label: string
  items: GuestNavItem[]
}

export const GUEST_DASHBOARD_HREF = "/guest"

export const GUEST_NAV_GROUPS: GuestNavGroup[] = [
  {
    id: "recommendations",
    label: "Recommendations",
    items: [
      {
        id: "rec-all",
        label: "All requests",
        href: "/guest/recommendations",
        icon: FilePenLine,
        capability: "recommendations.request",
      },
      {
        id: "rec-new",
        label: "New request",
        href: "/guest/recommendations/request",
        icon: PlusCircle,
        capability: "recommendations.request",
      },
    ],
  },
  {
    id: "cora-career",
    label: "Cora Career",
    items: [
      {
        id: "cora-assistant",
        label: GUEST_CORA_SIDEBAR_LABEL,
        href: "/guest/cora-career/chat",
        icon: CoraSidebarMark,
      },
      {
        id: "cora-match",
        label: "Résumé Match",
        href: "/guest/cora-career/match",
        icon: Sparkles,
      },
      {
        id: "cora-quick-scan",
        label: "Quick Scan",
        href: "/guest/cora-career/quick-scan",
        icon: Zap,
      },
      {
        id: "cora-cover-letter",
        label: "Cover Letter",
        href: "/guest/cora-career/cover-letter",
        icon: FileText,
      },
      {
        id: "cora-optimize",
        label: "Résumé Optimize",
        href: "/guest/cora-career/optimize",
        icon: Wand2,
      },
      {
        id: "cora-applications",
        label: "Applications",
        href: "/guest/cora-career/applications",
        icon: FilePenLine,
      },
      {
        id: "cora-credits",
        label: "Cora Credits",
        href: "/guest/cora-credits",
        icon: Coins,
      },
    ],
  },
  {
    id: "communication",
    label: "Communication",
    items: [
      {
        id: "messages",
        label: "Messages",
        href: "/guest/messages",
        icon: Mail,
        capability: "messages.use",
      },
      {
        id: "report-bug",
        label: "Report Bug",
        href: "/guest/report-bug",
        icon: Bug,
      },
      {
        id: "help-center",
        label: "Help Center",
        href: "/guest/help",
        icon: HelpCircle,
      },
      {
        id: "submit-ticket",
        label: "Submit Ticket",
        href: "/guest/submit-ticket",
        icon: Send,
      },
      {
        id: "feature-requests",
        label: "Feature Requests",
        href: "/guest/feature-requests",
        icon: Sparkles,
      },
    ],
  },
]

export const GUEST_SETTINGS_ITEM: GuestNavItem = {
  id: "settings",
  label: "Settings",
  href: "/guest/settings",
  icon: Settings,
}

export const GUEST_DASHBOARD_ITEM: GuestNavItem = {
  id: "dashboard",
  label: "Dashboard",
  href: GUEST_DASHBOARD_HREF,
  icon: LayoutDashboard,
}

export function filterGuestNavGroups(args: {
  capabilities: readonly GuestCapability[]
  plan: string
}): GuestNavGroup[] {
  const hasCareer = args.plan === "cora_career" || guestHasCapability(args.capabilities, "career.cora")

  return GUEST_NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => {
      if (item.showWhenFreeOnly && hasCareer) return false
      if (item.capability && !guestHasCapability(args.capabilities, item.capability)) return false
      return true
    }),
  })).filter((g) => g.items.length > 0)
}

export function guestBreadcrumbLabel(segment: string): string {
  const map: Record<string, string> = {
    guest: "Guest",
    recommendations: "Recommendations",
    request: "New request",
    messages: "Messages",
    "report-bug": "Report Bug",
    help: "Help Center",
    "help-center": "Help Center",
    "submit-ticket": "Submit Ticket",
    "feature-requests": "Feature Requests",
    profile: "Profile",
    settings: "Settings",
    security: "Security",
    appearance: "Appearance",
    career: "Cora Career",
    "cora-career": "Cora Career",
    "cora-credits": "Cora Credits",
    match: "Résumé Match",
    "quick-scan": "Quick Scan",
    "cover-letter": "Cover Letter",
    optimize: "Résumé Optimize",
    applications: "Applications",
    chat: "Cora Chat",
    access: "Lifetime access",
    membership: "Membership",
    other: "Other",
  }
  return map[segment] ?? segment.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}
