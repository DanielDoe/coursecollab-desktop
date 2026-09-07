import type { LucideIcon } from "lucide-react"
import {
  Activity,
  BarChart3,
  Brain,
  CheckCircle2,
  ClipboardList,
  Clock,
  FileText,
  GraduationCap,
  Layers,
  LayoutDashboard,
  Library,
  Lightbulb,
  Mail,
  Megaphone,
  MessageSquare,
  Presentation,
  ScrollText,
  Sparkles,
  TrendingUp,
  UserCheck,
  UsersRound,
  Wand2,
  Zap,
} from "lucide-react"
import { FACULTY_DASHBOARD_BASE } from "@/lib/faculty-portal-nav-config"
import type { FacultyCoraPlatformTab } from "@/lib/cora/faculty-platform-nav"
import type { CoraChrome } from "@/lib/cora/cora-chrome-theme"
import type { SolidListThumb } from "@/lib/student-color-hunt-theme"

export type FacultyCoraCapabilityId =
  | "create"
  | "improve"
  | "analyze"
  | "explain"
  | "automate"
  | "review"
  | "assistant"
  | "insights"

export type FacultyCoraRelatedModule = {
  href: string
  label: string
  icon: LucideIcon
}

export type FacultyCoraCapability = {
  id: FacultyCoraCapabilityId
  title: string
  emoji: string
  tagline: string
  description: string
  icon: LucideIcon
  examplePrompts: string[]
  tab: FacultyCoraPlatformTab
  relatedModules: FacultyCoraRelatedModule[]
}

const base = FACULTY_DASHBOARD_BASE

const MODULES = {
  "question-bank": { href: `${base}/assessments/quizzes/question-bank`, label: "Question Bank", icon: Library },
  quizzes: { href: `${base}/assessments/quizzes`, label: "Manage Quizzes", icon: ClipboardList },
  homework: { href: `${base}/assessments/homework`, label: "Manage Homework", icon: FileText },
  "mid-semester-exams": { href: `${base}/assessments/mid-semester`, label: "Mid-Semester Exams", icon: GraduationCap },
  syllabus: { href: `${base}/content/syllabus`, label: "Syllabus", icon: ScrollText },
  lectures: { href: `${base}/content/lectures`, label: "Manage Lectures", icon: Presentation },
  results: { href: `${base}/analytics?section=results`, label: "Manage Results", icon: BarChart3 },
  "student-progress": { href: `${base}/analytics?section=student-progress`, label: "Student Progress", icon: BarChart3 },
  reports: { href: `${base}/analytics?section=reports`, label: "Manage Reports", icon: FileText },
  attendance: { href: `${base}/assessments/attendance`, label: "Attendance", icon: UserCheck },
  "office-hours": { href: `${base}/learning-center/office-hours`, label: "Office Hours", icon: Clock },
  announcements: { href: `${base}/communication/announcements`, label: "Announcements", icon: Megaphone },
  flashcards: { href: `${base}/content/flashcards`, label: "Flashcards", icon: Layers },
  practice: { href: `${base}/content/practice`, label: "Manage Practice", icon: Brain },
  dashboard: { href: base, label: "Dashboard", icon: LayoutDashboard },
  "recent-activity": { href: base, label: "Recent Activity", icon: Activity },
  messages: { href: `${base}/communication/messages`, label: "Messages", icon: Mail },
  students: { href: `${base}/management/students`, label: "Student Directory", icon: UsersRound },
} satisfies Record<string, FacultyCoraRelatedModule>

export function relatedModulesFromIds(ids: string[]): FacultyCoraRelatedModule[] {
  return ids.map((id) => MODULES[id as keyof typeof MODULES]).filter(Boolean)
}

export const FACULTY_CORA_CAPABILITIES: FacultyCoraCapability[] = [
  {
    id: "create",
    title: "Create",
    emoji: "✨",
    tagline: "Build course content",
    description:
      "Propose assessments, lectures, study materials, and communication drafts. Faculty confirms before anything publishes.",
    icon: Sparkles,
    tab: "workspace",
    examplePrompts: [],
    relatedModules: [],
  },
  {
    id: "improve",
    title: "Improve",
    emoji: "🪄",
    tagline: "Refine what you have",
    description:
      "Improve difficulty, wording, distractors, Bloom's level, and fairness for quizzes, homework, and question bank items.",
    icon: Wand2,
    tab: "workspace",
    examplePrompts: [],
    relatedModules: [],
  },
  {
    id: "analyze",
    title: "Analyze",
    emoji: "📊",
    tagline: "Discover course patterns",
    description:
      "Analyze assessments, results, attendance, practice, and discussions to find gaps, duplicates, and hard topics.",
    icon: BarChart3,
    tab: "workspace",
    examplePrompts: [],
    relatedModules: [],
  },
  {
    id: "explain",
    title: "Explain",
    emoji: "💡",
    tagline: "Clarify concepts and trends",
    description:
      "Explain why students miss questions, common misconceptions, grading trends, electrical engineering topics, and AI flags.",
    icon: Lightbulb,
    tab: "workspace",
    examplePrompts: [],
    relatedModules: [],
  },
  {
    id: "automate",
    title: "Automate",
    emoji: "⚡",
    tagline: "Save repetitive work",
    description:
      "Plan weekly announcements, flashcard generation after lectures, review materials before exams, and office hour summaries.",
    icon: Zap,
    tab: "workspace",
    examplePrompts: [],
    relatedModules: [],
  },
  {
    id: "review",
    title: "Review",
    emoji: "✅",
    tagline: "Quality-check your course",
    description:
      "Audit syllabi, lectures, assessments, rubrics, flashcards, and policies for coverage, accessibility, and consistency.",
    icon: CheckCircle2,
    tab: "workspace",
    examplePrompts: [],
    relatedModules: [],
  },
  {
    id: "assistant",
    title: "Assistant",
    emoji: "💬",
    tagline: "Ask anything about your course",
    description: "Open chat for open-ended help building, grading, organizing, and analyzing your course.",
    icon: MessageSquare,
    tab: "workspace",
    examplePrompts: [],
    relatedModules: [],
  },
  {
    id: "insights",
    title: "Insights",
    emoji: "📈",
    tagline: "Proactive recommendations",
    description:
      "See what Cora notices this week — struggling topics, completion drops, and content that may need a rewrite.",
    icon: TrendingUp,
    tab: "workspace",
    examplePrompts: [],
    relatedModules: [],
  },
]

export function facultyCoraCapability(id: string): FacultyCoraCapability {
  return (
    FACULTY_CORA_CAPABILITIES.find((c) => c.id === id) ?? {
      id: id as FacultyCoraCapabilityId,
      title: id,
      emoji: "💬",
      tagline: "Teaching help",
      description: "",
      icon: MessageSquare,
      tab: "workspace",
      examplePrompts: [],
      relatedModules: [],
    }
  )
}

export function facultyCoraCapabilityThumb(id: string, chrome: CoraChrome): SolidListThumb {
  const index = FACULTY_CORA_CAPABILITIES.findIndex((c) => c.id === id)
  const cycle = chrome.roles.capability
  if (index < 0 || cycle.length === 0) return chrome.roles.cta
  return cycle[index % cycle.length]!
}

export function applyFacultyCoraPlaybook(
  capabilities: FacultyCoraCapability[],
  playbook: {
    capabilities?: Record<string, { prompts?: string[]; relatedModuleIds?: string[] }>
  } | null | undefined,
): FacultyCoraCapability[] {
  if (!playbook?.capabilities) {
    return capabilities.map((capability) => ({
      ...capability,
      examplePrompts: [],
      relatedModules: [],
    }))
  }
  return capabilities.map((capability) => {
    const generated = playbook.capabilities?.[capability.id]
    return {
      ...capability,
      examplePrompts: generated?.prompts?.filter(Boolean).slice(0, 4) ?? [],
      relatedModules: relatedModulesFromIds(generated?.relatedModuleIds ?? []),
    }
  })
}
