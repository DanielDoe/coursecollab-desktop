import type { CoraStudentContextPayload } from "@/lib/cora/fetch-student-context"

/** Pedagogical primitives Cora assembles into adaptive lessons. */
export type CoraLearnPrimitive =
  | "explain"
  | "visualize"
  | "example"
  | "check"
  | "recall"
  | "practice"
  | "reflect"
  | "teach_back"
  | "prerequisite"
  | "simplify"
  | "challenge"
  | "transfer"

export type CoraLearnActionId =
  | "explain"
  | "visualize"
  | "example"
  | "quiz"
  | "teach_back"
  | "practice"
  | "flashcards"
  | "summarize"

export type CoraLearnContinue = {
  title: string
  subtitle: string
  masteryPct: number
  minutesRemaining: number
  href: string
  hasActivity: boolean
}

export type CoraKnowledgeBar = {
  id: string
  label: string
  mastery: number
  status: "weak" | "strong" | "neutral"
  conceptsNeedingReview: number
}

export type CoraLearnRecommendation = {
  topic: string
  reason: string
  blocks: Array<{ label: string; mins: number }>
  totalMinutes: number
  prompt: string
}

export type CoraConceptNode = {
  id: string
  label: string
  x: number
  y: number
  blurb: string
  related: string[]
}

export const CORA_LEARN_ACTIONS: Array<{
  id: CoraLearnActionId
  label: string
  prompt: string
}> = [
  {
    id: "explain",
    label: "Explain",
    prompt: "Explain this concept with intuition first, then precise course language.",
  },
  {
    id: "visualize",
    label: "Visualize",
    prompt: "Visualize this concept with a clear diagram or animated mental model.",
  },
  {
    id: "example",
    label: "Show example",
    prompt: "Work a concrete example step by step for this concept.",
  },
  {
    id: "quiz",
    label: "Quiz me",
    prompt: "Quiz me with short checks. Hide answers until I try.",
  },
  {
    id: "teach_back",
    label: "Teach back",
    prompt: "I will teach this concept back to you. Challenge mistakes gently.",
  },
  {
    id: "practice",
    label: "Practice",
    prompt: "Give me guided practice problems on this concept with progressive hints.",
  },
  {
    id: "flashcards",
    label: "Flashcards",
    prompt: "Create a short active-recall flashcard set for this concept.",
  },
  {
    id: "summarize",
    label: "Summarize",
    prompt: "Summarize the key ideas I must remember for this material.",
  },
]

/** Default adaptive sequences by learner state. */
export const CORA_LEARN_ENGINE_SEQUENCES: Record<
  "default" | "struggling" | "mastered" | "gap",
  CoraLearnPrimitive[]
> = {
  default: ["explain", "visualize", "example", "practice"],
  struggling: ["prerequisite", "simplify", "example", "check", "practice"],
  gap: ["recall", "check", "explain", "example", "check"],
  mastered: ["recall", "challenge", "transfer"],
}

export const CORA_SESSION_DURATIONS = [15, 30, 45, 60] as const

export function buildSessionPlan(minutes: number): Array<{ label: string; mins: number }> {
  if (minutes <= 15) {
    return [
      { label: "Review", mins: 5 },
      { label: "Concept lesson", mins: 5 },
      { label: "Active recall", mins: 5 },
    ]
  }
  if (minutes <= 30) {
    return [
      { label: "Review", mins: 5 },
      { label: "Concept lesson", mins: 10 },
      { label: "Practice", mins: 10 },
      { label: "Active recall", mins: 5 },
    ]
  }
  if (minutes <= 45) {
    return [
      { label: "Review", mins: 8 },
      { label: "Concept lesson", mins: 15 },
      { label: "Practice", mins: 15 },
      { label: "Active recall", mins: 7 },
    ]
  }
  return [
    { label: "Review", mins: 10 },
    { label: "Concept lesson", mins: 20 },
    { label: "Practice", mins: 20 },
    { label: "Active recall", mins: 10 },
  ]
}

function asLectureRows(payload: CoraStudentContextPayload | null | undefined) {
  return (payload?.lectureProgress ?? []) as Array<Record<string, unknown>>
}

function lectureTitle(row: Record<string, unknown>): string {
  return String(row.title ?? row.lectureTitle ?? row.name ?? "Lecture")
}

function lectureWeek(row: Record<string, unknown>): string | null {
  const week = row.week ?? row.weekNumber
  if (week == null || week === "") return null
  return `Week ${week}`
}

export function deriveLearnContinue(
  payload: CoraStudentContextPayload | null | undefined,
): CoraLearnContinue {
  const lectures = asLectureRows(payload)
  const inProgress =
    lectures.find((r) => String(r.status ?? "").toLowerCase().includes("progress")) ??
    lectures.find((r) => r.lastAccessed) ??
    lectures[0]

  if (!inProgress) {
    return {
      title: "Continue where you left off",
      subtitle: "Select a lecture or material to begin learning with Cora.",
      masteryPct: 0,
      minutesRemaining: 0,
      href: "/student/dashboard-v2/lectures",
      hasActivity: false,
    }
  }

  const topicMastery = payload?.topicMastery ?? []
  const avg =
    topicMastery.length > 0
      ? Math.round(topicMastery.reduce((s, t) => s + (t.mastery ?? 0), 0) / topicMastery.length)
      : 58
  const week = lectureWeek(inProgress)
  const title = lectureTitle(inProgress)

  return {
    title: "Continue where you left off",
    subtitle: week ? `${week} · ${title}` : title,
    masteryPct: Math.max(8, Math.min(96, avg)),
    minutesRemaining: Math.max(8, 30 - Math.floor(avg / 5)),
    href: "/student/dashboard-v2/lectures",
    hasActivity: true,
  }
}

export function deriveKnowledgeBars(
  payload: CoraStudentContextPayload | null | undefined,
): CoraKnowledgeBar[] {
  const topics = payload?.topicMastery ?? []
  if (topics.length > 0) {
    return topics.slice(0, 6).map((t, i) => {
      const mastery = Math.round(Math.max(0, Math.min(100, t.mastery)))
      const status: CoraKnowledgeBar["status"] =
        t.status === "weak" || mastery < 40
          ? "weak"
          : t.status === "strong" || mastery >= 75
            ? "strong"
            : "neutral"
      return {
        id: `tm-${i}`,
        label: t.topic,
        mastery,
        status,
        conceptsNeedingReview: status === "weak" ? Math.max(2, Math.round((100 - mastery) / 25)) : 0,
      }
    })
  }

  const struggling = (payload?.strugglingTopics as string[] | undefined) ?? []
  const strengths = (payload?.strengths as string[] | undefined) ?? []
  const bars: CoraKnowledgeBar[] = []
  strengths.slice(0, 2).forEach((label, i) => {
    bars.push({
      id: `s-${i}`,
      label,
      mastery: 82 + i * 4,
      status: "strong",
      conceptsNeedingReview: 0,
    })
  })
  struggling.slice(0, 3).forEach((label, i) => {
    const mastery = 18 + i * 8
    bars.push({
      id: `w-${i}`,
      label,
      mastery,
      status: "weak",
      conceptsNeedingReview: Math.max(2, Math.round((100 - mastery) / 25)),
    })
  })
  if (bars.length === 0) {
    return [
      {
        id: "units",
        label: "Engineering Units & SI Prefixes",
        mastery: 82,
        status: "strong",
        conceptsNeedingReview: 0,
      },
      {
        id: "programming",
        label: "Introduction to Programming",
        mastery: 18,
        status: "weak",
        conceptsNeedingReview: 3,
      },
      {
        id: "circuit",
        label: "Circuit Analysis",
        mastery: 26,
        status: "weak",
        conceptsNeedingReview: 3,
      },
    ]
  }
  return bars
}

export function deriveLearnRecommendation(
  payload: CoraStudentContextPayload | null | undefined,
): CoraLearnRecommendation {
  const weak =
    payload?.strugglingTopics?.[0] ??
    payload?.topicMastery?.find((t) => t.mastery < 45)?.topic ??
    "Introduction to Programming"
  const blocks = [
    { label: "Review", mins: 8 },
    { label: "Flashcards", mins: 5 },
    { label: "Practice questions", mins: 5 },
  ]
  return {
    topic: weak,
    reason: `You struggled with ${weak} recently.`,
    blocks,
    totalMinutes: blocks.reduce((s, b) => s + b.mins, 0),
    prompt: `Teach me ${weak}. Start with an 8-minute review, then 5 active-recall flashcards, then 3 practice questions with hints. Adapt if I struggle.`,
  }
}

export function deriveSuggestedTopics(
  payload: CoraStudentContextPayload | null | undefined,
): string[] {
  const fromMastery = (payload?.topicMastery ?? [])
    .filter((t) => t.mastery < 70)
    .map((t) => t.topic)
    .slice(0, 3)
  if (fromMastery.length >= 2) return fromMastery
  const struggling = (payload?.strugglingTopics ?? []).slice(0, 3)
  if (struggling.length > 0) return struggling
  return ["RC Circuits", "Transient Response", "Op-Amps"]
}

export const CONCEPT_EXPLORER_NODES: CoraConceptNode[] = [
  {
    id: "root",
    label: "Circuit Theory",
    x: 50,
    y: 10,
    blurb: "Foundations for analyzing voltages, currents, and power in electrical networks.",
    related: ["Kirchhoff", "Current", "Mesh"],
  },
  {
    id: "k",
    label: "Kirchhoff",
    x: 28,
    y: 34,
    blurb: "KCL and KVL constrain currents at nodes and voltages around loops.",
    related: ["Circuit Theory", "Mesh", "Nodal Analysis"],
  },
  {
    id: "c",
    label: "Current",
    x: 72,
    y: 34,
    blurb: "Current is charge flow; branch and loop currents link Ohm’s law to network equations.",
    related: ["Circuit Theory", "Mesh", "Power"],
  },
  {
    id: "m",
    label: "Mesh Analysis",
    x: 50,
    y: 52,
    blurb: "Uses KVL to solve planar circuits by assigning currents to independent loops.",
    related: ["KVL", "Mesh Current", "Supermesh", "Dependent Sources"],
  },
  {
    id: "p",
    label: "Power",
    x: 50,
    y: 76,
    blurb: "Instantaneous and average power relate voltage and current; AC uses complex power.",
    related: ["Current", "Power Factor", "Complex Power"],
  },
]

export const CONCEPT_EXPLORER_EDGES = [
  ["root", "k"],
  ["root", "c"],
  ["k", "m"],
  ["c", "m"],
  ["m", "p"],
] as const

export function assembleLearnSequence(
  masteryPct: number | null | undefined,
): CoraLearnPrimitive[] {
  if (masteryPct == null) return CORA_LEARN_ENGINE_SEQUENCES.default
  if (masteryPct < 35) return CORA_LEARN_ENGINE_SEQUENCES.struggling
  if (masteryPct >= 80) return CORA_LEARN_ENGINE_SEQUENCES.mastered
  if (masteryPct < 55) return CORA_LEARN_ENGINE_SEQUENCES.gap
  return CORA_LEARN_ENGINE_SEQUENCES.default
}

export function buildLearnLaunchPrompt(input: {
  topic: string
  action?: CoraLearnActionId
  material?: string
  masteryPct?: number | null
}): string {
  const action = CORA_LEARN_ACTIONS.find((a) => a.id === (input.action ?? "explain"))
  const sequence = assembleLearnSequence(input.masteryPct)
  const seqLine = sequence.map((p) => p.replace("_", " ")).join(" → ")
  const material = input.material?.trim()
    ? `\n\nSource material:\n${input.material.trim().slice(0, 4000)}`
    : ""
  return [
    `Teach me: ${input.topic}`,
    action?.prompt ?? "Explain this concept clearly.",
    `Adaptive path for this learner: ${seqLine}.`,
    "Keep it interactive — ask checks, then continue. Prefer CourseCollab course fidelity over generic answers.",
    material,
  ]
    .filter(Boolean)
    .join("\n\n")
}
