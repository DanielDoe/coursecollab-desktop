import type { LucideIcon } from "lucide-react"
import {
  Home,
  MessageSquare,
  Sparkles,
  Wand2,
  BarChart3,
  Lightbulb,
  Zap,
  CheckCircle2,
  TrendingUp,
  Settings,
} from "lucide-react"

export type FacultyCoraPlatformTab =
  | "home"
  | "workspace"
  | "create"
  | "improve"
  | "analyze"
  | "explain"
  | "automate"
  | "review"
  | "assistant"
  | "insights"
  | "preferences"

export type FacultyCoraNavItem = {
  id: FacultyCoraPlatformTab
  label: string
  icon: LucideIcon
}

export const FACULTY_CORA_PLATFORM_NAV: FacultyCoraNavItem[] = [
  { id: "home", label: "Home", icon: Home },
  { id: "workspace", label: "Chat", icon: MessageSquare },
  { id: "create", label: "Create", icon: Sparkles },
  { id: "improve", label: "Improve", icon: Wand2 },
  { id: "analyze", label: "Analyze", icon: BarChart3 },
  { id: "explain", label: "Explain", icon: Lightbulb },
  { id: "automate", label: "Automate", icon: Zap },
  { id: "review", label: "Review", icon: CheckCircle2 },
  { id: "assistant", label: "Assistant", icon: MessageSquare },
  { id: "insights", label: "Insights", icon: TrendingUp },
  { id: "preferences", label: "Preferences", icon: Settings },
]

export const FACULTY_CORA_CAPABILITY_TABS = [
  "create",
  "improve",
  "analyze",
  "explain",
  "automate",
  "review",
  "assistant",
  "insights",
] as const

export function isFacultyCoraCapabilityTab(
  tab: FacultyCoraPlatformTab,
): tab is (typeof FACULTY_CORA_CAPABILITY_TABS)[number] {
  return (FACULTY_CORA_CAPABILITY_TABS as readonly string[]).includes(tab)
}
