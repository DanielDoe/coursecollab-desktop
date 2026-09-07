import { DASHBOARD_V2_MODULES } from "@/lib/dashboard-v2-nav"
import { CORA_HOME_ACTIONS, CORA_PLATFORM_NAV, type CoraPlatformTab } from "@/lib/cora/platform-nav"

export type PlatformCatalogEntry = {
  id: string
  label: string
  group: string
  href?: string
  tab?: CoraPlatformTab
  toolId?: string
  aliases: string[]
}

const EXTRA_MODULES: PlatformCatalogEntry[] = [
  {
    id: "flashcards",
    label: "Flashcards",
    href: "/student/dashboard-v2/flashcards",
    group: "Learning Center",
    aliases: ["flashcard", "flash cards", "decks"],
  },
  {
    id: "notes",
    label: "My Notes",
    href: "/student/dashboard-v2/notes",
    group: "Learning Center",
    aliases: ["note", "digital notes", "my notes"],
  },
]

const AI_TOOLS: PlatformCatalogEntry[] = [
  {
    id: "concept-explainer",
    label: "Concept Explainer",
    tab: "tools",
    toolId: "concept-explainer",
    group: "Cora Tools",
    aliases: ["explain concept", "concept explainer"],
  },
  {
    id: "mini-lesson",
    label: "Mini Lesson Generator",
    tab: "tools",
    toolId: "mini-lesson",
    group: "Cora Tools",
    aliases: ["mini lesson", "lesson generator"],
  },
  {
    id: "study-plan",
    label: "Study Plan Creator",
    tab: "study-plan",
    group: "Cora Tools",
    aliases: ["study plan", "study schedule", "exam prep plan"],
  },
  {
    id: "smart-debugger",
    label: "Smart Debugger",
    tab: "tools",
    toolId: "smart-debugger",
    group: "Cora Tools",
    aliases: ["debugger", "debug code", "smart debugger"],
  },
  {
    id: "quiz-generator",
    label: "Quiz Generator",
    tab: "tools",
    toolId: "quiz-generator",
    group: "Cora Tools",
    aliases: ["quiz generator", "generate quiz tool"],
  },
]

const MODULE_ALIASES: Record<string, string[]> = {
  dashboard: ["home", "main"],
  lectures: ["lecture", "slides", "videos"],
  practice: ["practice hub", "practice questions", "drill"],
  "ai-tutor": ["cora", "ai tutor", "tutor"],
  quizzes: ["quiz", "weekly quiz"],
  homework: ["hw", "assignments", "assignment"],
  grades: ["gradebook", "my grades", "score"],
  announcements: ["announcement", "news"],
  forum: ["discussion", "discussions"],
  calendar: ["schedule", "events"],
  syllabus: ["course outline"],
  "mid-semester-exams": ["midterm", "mid-semester", "mid semester"],
  "final-exams": ["final", "final exam"],
}

export const PLATFORM_CATALOG: PlatformCatalogEntry[] = [
  ...DASHBOARD_V2_MODULES.map((m) => ({
    id: m.id,
    label: m.label,
    href: m.href,
    group: m.group,
    aliases: [m.label.toLowerCase(), ...(MODULE_ALIASES[m.id] ?? [])],
  })),
  ...EXTRA_MODULES,
  ...CORA_PLATFORM_NAV.map((n) => ({
    id: `cora-${n.id}`,
    label: `Cora ${n.label}`,
    tab: n.id,
    group: "Cora",
    aliases: [n.id, n.label.toLowerCase(), `cora ${n.id}`, `cora ${n.id.replace("-", " ")}`, `cora ${n.label.toLowerCase()}`],
  })),
  ...CORA_HOME_ACTIONS.map((a) => ({
    id: a.id,
    label: a.title,
    tab: a.tab,
    toolId: a.toolId,
    group: "Cora Actions",
    aliases: [a.title.toLowerCase(), a.description.toLowerCase()],
  })),
  ...AI_TOOLS,
]

function normalizeQuery(q: string): string {
  return q.trim().toLowerCase().replace(/\s+/g, " ")
}

function scoreEntry(query: string, entry: PlatformCatalogEntry): number {
  const q = normalizeQuery(query)
  if (!q) return 0

  const candidates = [entry.label.toLowerCase(), ...entry.aliases.map(normalizeQuery)]
  let best = 0

  for (const c of candidates) {
    if (c === q) best = Math.max(best, 100)
    else if (c.startsWith(q) || q.startsWith(c)) best = Math.max(best, 80)
    else if (c.includes(q) || q.includes(c)) best = Math.max(best, 60)
    else {
      const qWords = q.split(" ")
      const matched = qWords.filter((w) => w.length > 2 && c.includes(w)).length
      if (matched > 0) best = Math.max(best, 40 + matched * 10)
    }
  }

  return best
}

export function matchPlatformEntry(query: string, minScore = 55): PlatformCatalogEntry | null {
  const ranked = PLATFORM_CATALOG.map((entry) => ({ entry, score: scoreEntry(query, entry) }))
    .filter((r) => r.score >= minScore)
    .sort((a, b) => b.score - a.score)

  return ranked[0]?.entry ?? null
}

export function searchPlatformCatalog(query: string, limit = 8): PlatformCatalogEntry[] {
  const q = normalizeQuery(query)
  if (!q) return PLATFORM_CATALOG.slice(0, limit)

  return PLATFORM_CATALOG.map((entry) => ({ entry, score: scoreEntry(q, entry) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((r) => r.entry)
}

export function formatCapabilitiesHelp(): string {
  const lines = [
    "I'm a **read-only** CourseCollab agent — I can see your data and guide you, but I won't change grades, membership, or save content for you.",
    "",
    "**What I can do from chat:**",
    "- **Search** — find pages, lectures, topics, announcements (*search for homework*)",
    "- **Navigate** — open any area (*go to grades*, *open practice hub*)",
    "- **Cora tabs** — switch tabs (*open study plan*, `/cora tools`)",
    "- **Explain** — grades, calendar, assessments, mastery, membership tier, and credits from your live profile",
    "",
    "**Use the app directly to create/save:** notes, flashcards, calendar events, quiz submissions, membership upgrades.",
    "",
    "Slash commands: `/search`, `/go`, `/cora`, `/help`",
  ]
  return lines.join("\n")
}
