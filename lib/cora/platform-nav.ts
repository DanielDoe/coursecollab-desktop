import type { LucideIcon } from "lucide-react"
import {
  BarChart3,
  BookOpen,
  Brain,
  Code2,
  Home,
  MessageSquare,
  Settings,
  Target,
  Wrench,
} from "lucide-react"

export type CoraPlatformTab =
  | "home"
  | "workspace"
  | "solve"
  | "learn"
  | "code"
  | "insights"
  | "study-plan"
  | "tools"
  | "preferences"

export type CoraNavItem = {
  id: CoraPlatformTab
  label: string
  icon: LucideIcon
}

export const CORA_PLATFORM_NAV: CoraNavItem[] = [
  { id: "home", label: "Home", icon: Home },
  { id: "workspace", label: "Workspace", icon: MessageSquare },
  { id: "solve", label: "Solve", icon: Brain },
  { id: "learn", label: "Learn", icon: BookOpen },
  { id: "code", label: "Code", icon: Code2 },
  { id: "insights", label: "Insights", icon: BarChart3 },
  { id: "study-plan", label: "Study Plan", icon: Target },
  { id: "tools", label: "Studio", icon: Wrench },
  { id: "preferences", label: "Preferences", icon: Settings },
]

export type CoraHomeAction = {
  id: string
  title: string
  description: string
  tab: CoraPlatformTab
  toolId?: string
}

export const CORA_HOME_ACTIONS: CoraHomeAction[] = [
  { id: "explain", title: "Explain a Problem", description: "Break down any question step by step", tab: "solve" },
  { id: "circuit", title: "Walk Me Through a Circuit", description: "Animated circuit analysis", tab: "solve", toolId: "circuit" },
  { id: "code-help", title: "Help Me Code", description: "Debug, trace, and visualize execution", tab: "code" },
  { id: "exam", title: "Prepare Me for an Exam", description: "Adaptive review and practice", tab: "study-plan" },
  { id: "homework", title: "Review My Homework", description: "Course-aware feedback", tab: "learn" },
  { id: "flashcards", title: "Generate Flashcards", description: "From lectures or topics", tab: "tools", toolId: "flashcard-generator" },
  { id: "lecture", title: "Summarize Lecture", description: "Notes, glossary, and quiz", tab: "learn" },
  { id: "plan", title: "Create Study Plan", description: "Daily and exam schedules", tab: "study-plan" },
]
