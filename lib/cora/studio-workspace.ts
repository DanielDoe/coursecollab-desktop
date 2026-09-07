import type { LucideIcon } from "lucide-react"
import {
  BookOpen,
  Brain,
  Calendar,
  ClipboardList,
  Code2,
  FileText,
  Flame,
  GraduationCap,
  Layers,
  Lightbulb,
  Map,
  Sparkles,
  Target,
  Wand2,
  Bug,
  Eye,
  Network,
} from "lucide-react"
import type { CoraPlatformTab } from "@/lib/cora/platform-nav"
import type { CoraStudentContextPayload } from "@/lib/cora/fetch-student-context"

export type StudioWorkspaceId = "learn" | "practice" | "create" | "analyze" | "plan"

export type StudioLaunch =
  | { kind: "tool"; toolId: string }
  | { kind: "tab"; tab: CoraPlatformTab }
  | { kind: "href"; href: string }
  | { kind: "prompt"; title: string; prompt: string }

export type StudioTool = {
  id: string
  title: string
  description: string
  workspace: StudioWorkspaceId
  eta: string
  popularity: number
  featured?: boolean
  launch: StudioLaunch
  aliases: string[]
}

export type StudioWorkflow = {
  id: string
  title: string
  description: string
  steps: string[]
  launch: StudioLaunch
}

export type StudioPromptChip = {
  id: string
  label: string
  launch: StudioLaunch
}

export const STUDIO_WORKSPACES: Array<{ id: StudioWorkspaceId; label: string }> = [
  { id: "learn", label: "Learn" },
  { id: "practice", label: "Practice" },
  { id: "create", label: "Create" },
  { id: "analyze", label: "Analyze" },
  { id: "plan", label: "Plan" },
]

/** Icons keyed by tool id for the panel (keeps workspace data serializable-ish). */
export const STUDIO_TOOL_ICONS: Record<string, LucideIcon> = {
  "concept-explainer": Lightbulb,
  "mini-lesson": BookOpen,
  "simplify-topic": Wand2,
  "visual-diagrams": Network,
  "formula-explorer": Flame,
  "flashcards": Layers,
  "quiz-generator": ClipboardList,
  "practice-generator": Target,
  "exam-mode": GraduationCap,
  "walkthrough": Brain,
  "study-notes": FileText,
  "study-guide": BookOpen,
  "formula-sheet": Flame,
  "cheat-sheet": FileText,
  "summary": Sparkles,
  "mind-map": Map,
  "quiz-analysis": ClipboardList,
  "homework-review": FileText,
  "mistake-analysis": Bug,
  "code-quality": Code2,
  "learning-insights": Eye,
  "study-plan": Target,
  "calendar-assistant": Calendar,
  "weekly-review": Calendar,
  "goal-tracker": Target,
  "session-builder": Sparkles,
  "smart-debugger": Bug,
  "execution-visualizer": Eye,
  "mock-interviewer": Brain,
}

export const STUDIO_TOOLS: StudioTool[] = [
  // Learn
  {
    id: "concept-explainer",
    title: "Concept Explorer",
    description: "Adaptive explanations at any difficulty level.",
    workspace: "learn",
    eta: "≈2 min",
    popularity: 98,
    featured: true,
    launch: { kind: "tool", toolId: "concept-explainer" },
    aliases: ["explain", "concept", "explorer"],
  },
  {
    id: "mini-lesson",
    title: "Mini Lesson",
    description: "Focused 2–3 minute lessons with a quick check.",
    workspace: "learn",
    eta: "≈3 min",
    popularity: 86,
    featured: true,
    launch: { kind: "tool", toolId: "mini-lesson" },
    aliases: ["lesson", "teach"],
  },
  {
    id: "simplify-topic",
    title: "Simplify Topic",
    description: "ELI5 → exam-ready explanations of the same idea.",
    workspace: "learn",
    eta: "≈1 min",
    popularity: 80,
    launch: { kind: "tool", toolId: "simplify-topic" },
    aliases: ["simplify", "eli5"],
  },
  {
    id: "visual-diagrams",
    title: "Visual Diagrams",
    description: "Flowcharts, concept maps, and visual explanations.",
    workspace: "learn",
    eta: "≈2 min",
    popularity: 77,
    launch: { kind: "tool", toolId: "visual-diagrams" },
    aliases: ["diagram", "visual", "flowchart"],
  },
  {
    id: "formula-explorer",
    title: "Formula Explorer",
    description: "Interactive formulas, variables, and common mistakes.",
    workspace: "learn",
    eta: "≈2 min",
    popularity: 84,
    featured: true,
    launch: { kind: "tool", toolId: "formula-explorer" },
    aliases: ["formula", "equation"],
  },
  // Practice
  {
    id: "flashcards",
    title: "Flashcards",
    description: "Generate and review decks from weak topics.",
    workspace: "practice",
    eta: "≈1 min",
    popularity: 95,
    featured: true,
    launch: { kind: "tool", toolId: "flashcards" },
    aliases: ["cards", "anki", "flashcard"],
  },
  {
    id: "practice-generator",
    title: "Practice Generator",
    description: "Adaptive practice questions matched to your course.",
    workspace: "practice",
    eta: "≈1 min",
    popularity: 92,
    launch: { kind: "href", href: "/student/dashboard-v2/practice" },
    aliases: ["practice", "problems"],
  },
  {
    id: "quiz-generator",
    title: "Mini Quiz",
    description: "Create a scored practice quiz in seconds.",
    workspace: "practice",
    eta: "≈30 sec",
    popularity: 90,
    featured: true,
    launch: { kind: "tool", toolId: "quiz-generator" },
    aliases: ["quiz"],
  },
  {
    id: "walkthrough",
    title: "Interactive Walkthrough",
    description: "Step-by-step Solve sessions with Cora.",
    workspace: "practice",
    eta: "≈5 min",
    popularity: 88,
    launch: { kind: "tab", tab: "solve" },
    aliases: ["walkthrough", "solve"],
  },
  {
    id: "exam-mode",
    title: "Exam Simulator",
    description: "Exam-style questions and rubrics under time pressure.",
    workspace: "practice",
    eta: "≈10 min",
    popularity: 81,
    launch: { kind: "tool", toolId: "exam-mode" },
    aliases: ["exam", "simulator"],
  },
  // Create
  {
    id: "study-notes",
    title: "Study Notes",
    description: "Beautiful structured notes from lectures, PDFs, and images.",
    workspace: "create",
    eta: "≈1 min",
    popularity: 94,
    featured: true,
    launch: { kind: "tool", toolId: "study-notes" },
    aliases: ["notes", "note"],
  },
  {
    id: "study-guide",
    title: "Study Guide",
    description: "One cohesive guide for a chapter or exam unit.",
    workspace: "create",
    eta: "≈2 min",
    popularity: 79,
    launch: { kind: "tool", toolId: "study-guide" },
    aliases: ["guide"],
  },
  {
    id: "formula-sheet",
    title: "Formula Sheet",
    description: "Clean formula sheet ready for review or print.",
    workspace: "create",
    eta: "≈30 sec",
    popularity: 91,
    featured: true,
    launch: { kind: "tool", toolId: "formula-sheet" },
    aliases: ["formulas"],
  },
  {
    id: "cheat-sheet",
    title: "Cheat Sheet",
    description: "One-page high-yield reference for exams.",
    workspace: "create",
    eta: "≈1 min",
    popularity: 85,
    launch: { kind: "tool", toolId: "cheat-sheet" },
    aliases: ["cheatsheet"],
  },
  {
    id: "summary",
    title: "Summary",
    description: "Condense a lecture, chapter, or PDF into essentials.",
    workspace: "create",
    eta: "≈30 sec",
    popularity: 87,
    launch: { kind: "tool", toolId: "summary" },
    aliases: ["summarize", "summary"],
  },
  {
    id: "mind-map",
    title: "Mind Map",
    description: "Map how concepts connect across the course.",
    workspace: "create",
    eta: "≈2 min",
    popularity: 72,
    launch: { kind: "tool", toolId: "mind-map" },
    aliases: ["mindmap"],
  },
  // Analyze
  {
    id: "quiz-analysis",
    title: "Quiz Analysis",
    description: "See where points are leaking and what to fix.",
    workspace: "analyze",
    eta: "≈2 min",
    popularity: 76,
    launch: { kind: "tool", toolId: "quiz-analysis" },
    aliases: ["quiz analysis"],
  },
  {
    id: "homework-review",
    title: "Homework Review",
    description: "Review approach, gaps, and redo strategy.",
    workspace: "analyze",
    eta: "≈3 min",
    popularity: 83,
    launch: { kind: "tool", toolId: "homework-review" },
    aliases: ["homework", "hw"],
  },
  {
    id: "mistake-analysis",
    title: "Mistake Analysis",
    description: "Pattern-level mistakes — not just wrong answers.",
    workspace: "analyze",
    eta: "≈2 min",
    popularity: 78,
    launch: { kind: "tool", toolId: "mistake-analysis" },
    aliases: ["mistakes"],
  },
  {
    id: "code-quality",
    title: "Code Review",
    description: "Style, complexity, correctness, and refactor hints.",
    workspace: "analyze",
    eta: "≈2 min",
    popularity: 82,
    featured: true,
    launch: { kind: "tool", toolId: "code-quality" },
    aliases: ["code review", "quality"],
  },
  {
    id: "learning-insights",
    title: "Learning Insights",
    description: "Academic health, readiness, and focus areas.",
    workspace: "analyze",
    eta: "≈1 min",
    popularity: 74,
    launch: { kind: "tab", tab: "insights" },
    aliases: ["insights", "analytics"],
  },
  {
    id: "smart-debugger",
    title: "Smart Debugger",
    description: "Find bugs, explain root causes, show fixes.",
    workspace: "analyze",
    eta: "≈2 min",
    popularity: 80,
    launch: { kind: "tool", toolId: "smart-debugger" },
    aliases: ["debug", "debugger"],
  },
  {
    id: "execution-visualizer",
    title: "Execution Visualizer",
    description: "Watch variables and control flow step by step.",
    workspace: "analyze",
    eta: "≈3 min",
    popularity: 75,
    launch: { kind: "tool", toolId: "execution-visualizer" },
    aliases: ["visualize", "execution"],
  },
  // Plan
  {
    id: "study-plan",
    title: "Study Plan",
    description: "AI daily coach — journey, deadlines, and sessions.",
    workspace: "plan",
    eta: "≈1 min",
    popularity: 89,
    featured: true,
    launch: { kind: "tab", tab: "study-plan" },
    aliases: ["plan", "schedule"],
  },
  {
    id: "calendar-assistant",
    title: "Calendar Assistant",
    description: "Deadlines, missed work, and next 48 hours.",
    workspace: "plan",
    eta: "≈1 min",
    popularity: 70,
    launch: { kind: "tab", tab: "study-plan" },
    aliases: ["calendar"],
  },
  {
    id: "weekly-review",
    title: "Weekly Review",
    description: "Progress recap and next-week priorities.",
    workspace: "plan",
    eta: "≈2 min",
    popularity: 68,
    launch: { kind: "tool", toolId: "weekly-review" },
    aliases: ["weekly"],
  },
  {
    id: "goal-tracker",
    title: "Goal Tracker",
    description: "Weekly goals across lectures, practice, and quizzes.",
    workspace: "plan",
    eta: "≈1 min",
    popularity: 66,
    launch: { kind: "tab", tab: "study-plan" },
    aliases: ["goals"],
  },
  {
    id: "session-builder",
    title: "Session Builder",
    description: "Quick, today, or deep study sessions on demand.",
    workspace: "plan",
    eta: "≈30 sec",
    popularity: 73,
    launch: { kind: "tab", tab: "study-plan" },
    aliases: ["session"],
  },
  {
    id: "mock-interviewer",
    title: "Mock Interviewer",
    description: "Practice coding interviews with Cora.",
    workspace: "practice",
    eta: "≈15 min",
    popularity: 64,
    launch: { kind: "tool", toolId: "mock-interviewer" },
    aliases: ["interview"],
  },
]

export const STUDIO_PROMPT_CHIPS: StudioPromptChip[] = [
  {
    id: "c1",
    label: "Generate Study Notes",
    launch: { kind: "tool", toolId: "study-notes" },
  },
  {
    id: "c2",
    label: "Explain a Concept",
    launch: { kind: "tool", toolId: "concept-explainer" },
  },
  {
    id: "c3",
    label: "Build Flashcards",
    launch: { kind: "tool", toolId: "flashcards" },
  },
  {
    id: "c4",
    label: "Create Practice Quiz",
    launch: { kind: "tool", toolId: "quiz-generator" },
  },
  {
    id: "c5",
    label: "Analyze Homework",
    launch: { kind: "tool", toolId: "homework-review" },
  },
  {
    id: "c6",
    label: "Review Code",
    launch: { kind: "tool", toolId: "code-quality" },
  },
  {
    id: "c7",
    label: "Generate Formula Sheet",
    launch: { kind: "tool", toolId: "formula-sheet" },
  },
  {
    id: "c8",
    label: "Build Study Plan",
    launch: { kind: "tool", toolId: "study-plan-builder" },
  },
]

/** Map prompt / generated titles → drawer tool ids (never open Cora modal for these). */
export const STUDIO_DRAWER_TITLE_MAP: Record<string, string> = {
  "study notes": "study-notes",
  "generate study notes": "study-notes",
  "concept explorer": "concept-explainer",
  "concept explainer": "concept-explainer",
  "explain a concept": "concept-explainer",
  flashcards: "flashcards",
  "build flashcards": "flashcards",
  "mini quiz": "quiz-generator",
  "create practice quiz": "quiz-generator",
  "quiz generator": "quiz-generator",
  "homework review": "homework-review",
  "analyze homework": "homework-review",
  "code review": "code-quality",
  "review code": "code-quality",
  "formula sheet": "formula-sheet",
  "generate formula sheet": "formula-sheet",
  "formula explorer": "formula-explorer",
  "mini lesson": "mini-lesson",
  "study plan": "study-plan-builder",
  "build study plan": "study-plan-builder",
  "study plan builder": "study-plan-builder",
  "weekly review": "weekly-review",
  summary: "summary",
  "cheat sheet": "cheat-sheet",
  "study guide": "study-guide",
  "mind map": "mind-map",
  "mistake analysis": "mistake-analysis",
  "quiz analysis": "quiz-analysis",
}

export function resolveStudioDrawerToolId(launch: StudioLaunch): string | null {
  if (launch.kind === "tool") return launch.toolId
  if (launch.kind === "prompt") {
    const key = launch.title.trim().toLowerCase()
    return STUDIO_DRAWER_TITLE_MAP[key] ?? null
  }
  return null
}

export const STUDIO_WORKFLOWS: StudioWorkflow[] = [
  {
    id: "midterm",
    title: "Midterm Preparation",
    description: "Lectures → notes → flashcards → practice → mini exam → report.",
    steps: [
      "Review lectures",
      "Generate notes",
      "Create flashcards",
      "Practice questions",
      "Interactive walkthrough",
      "Mini exam",
      "Performance report",
    ],
    launch: {
      kind: "prompt",
      title: "Midterm Preparation Workflow",
      prompt:
        "Launch a midterm preparation workflow for me: review lectures, generate notes, flashcards, practice, walkthrough, mini exam, and a performance report. Use my CourseCollab weak topics and upcoming assessments.",
    },
  },
  {
    id: "lecture",
    title: "Lecture Review",
    description: "Summarize, note, and quiz a single lecture.",
    steps: ["Open lecture", "Summary", "Notes", "Flashcards", "Mini quiz"],
    launch: {
      kind: "prompt",
      title: "Lecture Review Workflow",
      prompt: "Run a lecture review workflow: summarize the lecture, create notes and flashcards, then a short quiz.",
    },
  },
  {
    id: "homework",
    title: "Homework Review",
    description: "Mistake patterns → redo plan → practice.",
    steps: ["Review mistakes", "Explain gaps", "Redo plan", "Practice set"],
    launch: {
      kind: "prompt",
      title: "Homework Review Workflow",
      prompt: "Run a homework review workflow: analyze mistakes, explain gaps, create a redo plan, then practice questions.",
    },
  },
  {
    id: "coding",
    title: "Coding Assignment",
    description: "Understand → code → debug → visualize → optimize.",
    steps: ["Understand prompt", "Scaffold", "Debug", "Visualize", "Optimize"],
    launch: { kind: "tab", tab: "code" },
  },
  {
    id: "circuit",
    title: "Circuit Problem Solving",
    description: "Guided Solve for circuit homework and quizzes.",
    steps: ["Parse problem", "Choose method", "Solve", "Check", "Reflect"],
    launch: { kind: "tab", tab: "solve" },
  },
  {
    id: "final",
    title: "Final Exam Preparation",
    description: "Full-course recovery and simulation.",
    steps: ["Mastery map", "Weak topics", "Study guide", "Exam sim", "Reflection"],
    launch: {
      kind: "prompt",
      title: "Final Exam Workflow",
      prompt:
        "Build a final exam preparation workflow from my mastery gaps: study guide, formula sheet, practice, exam simulation, and a readiness report.",
    },
  },
]

export const STUDIO_TEMPLATES = [
  "Exam Week",
  "Midterm Review",
  "Homework Review",
  "Lecture Summary",
  "Coding Interview",
  "Lab Report",
  "Programming Assignment",
  "Circuit Analysis",
] as const

export const STUDIO_FAVORITES_KEY = "coraStudioFavorites"
export const STUDIO_RECENT_KEY = "coraStudioRecent"
export const STUDIO_GENERATED_KEY = "coraStudioGenerated"

export function searchStudioTools(query: string): StudioTool[] {
  const q = query.trim().toLowerCase()
  if (!q) return STUDIO_TOOLS
  return STUDIO_TOOLS.filter(
    (t) =>
      t.title.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.aliases.some((a) => a.includes(q)) ||
      t.workspace.includes(q),
  )
}

export function featuredTools(): StudioTool[] {
  return STUDIO_TOOLS.filter((t) => t.featured).slice(0, 6)
}

export function toolsByWorkspace(id: StudioWorkspaceId): StudioTool[] {
  return STUDIO_TOOLS.filter((t) => t.workspace === id)
}

export function deriveStudioRecommendations(ctx: CoraStudentContextPayload | null | undefined): {
  topic: string
  actions: StudioTool[]
} {
  const topic = ctx?.strugglingTopics?.[0] || "AC Power"
  const ids = ["formula-sheet", "quiz-generator", "walkthrough", "homework-review"]
  const actions = ids
    .map((id) => STUDIO_TOOLS.find((t) => t.id === id))
    .filter((t): t is StudioTool => Boolean(t))
  return { topic, actions }
}

export function loadStudioIdList(key: string): string[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw) as string[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveStudioIdList(key: string, ids: string[]) {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(key, JSON.stringify(ids.slice(0, 12)))
  } catch {
    /* ignore */
  }
}

export function popularThisWeek(): StudioTool[] {
  return [...STUDIO_TOOLS].sort((a, b) => b.popularity - a.popularity).slice(0, 6)
}

export function newAiFeatures(): StudioTool[] {
  return STUDIO_TOOLS.filter((t) =>
    ["formula-explorer", "mind-map", "session-builder", "walkthrough"].includes(t.id),
  )
}
