import type { CoraStudentContextPayload } from "@/lib/cora/fetch-student-context"
import { deriveFocusTopics } from "@/lib/cora/study-plan-workspace"

export type StudyNotesSectionPhase =
  | "scan"
  | "overview"
  | "core"
  | "example"
  | "pitfalls"
  | "check"
  | "recap"

export type StudyNotesSection = {
  id: string
  index: number
  phase: StudyNotesSectionPhase
  title: string
  body: string
  checkpoint?: string | null
}

export type StudyNotesPack = {
  title: string
  topic: string
  courseLabel?: string | null
  sources: string[]
  sections: StudyNotesSection[]
  generatedAt: string
  /** outline | detailed | exam */
  style?: string | null
}

export type StudyNotesPersistedSession = {
  pack: StudyNotesPack
  stepIndex: number
  completed: string[]
  mode: string
  updatedAt: string
}

const STUDY_NOTES_STORAGE_PREFIX = "cora-study-notes-v1:"

function storageKey(studentId: string) {
  return `${STUDY_NOTES_STORAGE_PREFIX}${studentId || "anon"}`
}

export function loadStudyNotesSession(studentId: string): StudyNotesPersistedSession | null {
  if (typeof window === "undefined" || !studentId) return null
  try {
    const raw = localStorage.getItem(storageKey(studentId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as StudyNotesPersistedSession
    if (!parsed?.pack?.sections?.length) return null
    return {
      pack: parsed.pack,
      stepIndex: Math.max(0, Number(parsed.stepIndex) || 0),
      completed: Array.isArray(parsed.completed) ? parsed.completed.map(String) : [],
      mode: typeof parsed.mode === "string" && parsed.mode ? parsed.mode : "detailed",
      updatedAt: parsed.updatedAt || parsed.pack.generatedAt,
    }
  } catch {
    return null
  }
}

export function saveStudyNotesSession(
  studentId: string,
  session: Omit<StudyNotesPersistedSession, "updatedAt"> & { updatedAt?: string },
): void {
  if (typeof window === "undefined" || !studentId || !session.pack?.sections?.length) return
  try {
    const payload: StudyNotesPersistedSession = {
      pack: session.pack,
      stepIndex: session.stepIndex,
      completed: session.completed,
      mode: session.mode || "detailed",
      updatedAt: session.updatedAt || new Date().toISOString(),
    }
    localStorage.setItem(storageKey(studentId), JSON.stringify(payload))
  } catch {
    // ignore quota / private mode
  }
}

export function clearStudyNotesSession(studentId: string): void {
  if (typeof window === "undefined" || !studentId) return
  try {
    localStorage.removeItem(storageKey(studentId))
  } catch {
    // ignore
  }
}

export const STUDY_NOTES_PHASE_LABELS: Record<StudyNotesSectionPhase, string> = {
  scan: "Scan",
  overview: "Overview",
  core: "Core ideas",
  example: "Example",
  pitfalls: "Watch outs",
  check: "Check",
  recap: "Recap",
}

export function deriveStudyNotesSeedTopic(
  ctx: CoraStudentContextPayload | null | undefined,
  override?: string | null,
): string {
  const trimmed = override?.trim()
  if (trimmed) return trimmed
  return deriveFocusTopics(ctx)[0] || "Course fundamentals"
}

export function buildStudyNotesScanContext(
  ctx: CoraStudentContextPayload | null | undefined,
  topicOverride?: string | null,
): {
  topic: string
  courseLabel: string | null
  sources: string[]
  contextBlock: string
} {
  const topic = deriveStudyNotesSeedTopic(ctx, topicOverride)
  const courseLabel =
    [ctx?.account?.courseCode, ctx?.account?.courseTitle].filter(Boolean).join(" · ") || null
  const weak = (ctx?.strugglingTopics ?? []).slice(0, 5)
  const mastery = (ctx?.topicMastery ?? [])
    .filter((t) => Number(t.mastery) < 75)
    .slice(0, 5)
    .map((t) => `${t.topic} (${Math.round(Number(t.mastery))}%)`)
  const upcoming = (ctx?.upcomingAssessments ?? [])
    .slice(0, 4)
    .map((a) => `${a.title}${a.dueDate ? ` · due ${a.dueDate.slice(0, 10)}` : ""}`)
  const notes = (ctx?.digitalNotes ?? []).slice(0, 4).map((n) => n.title)
  const decks = (ctx?.flashcardDecks ?? []).slice(0, 4).map((d) => d.title)

  const sources = [
    ...weak.map((t) => `Weak: ${t}`),
    ...mastery.map((t) => `Mastery: ${t}`),
    ...upcoming.map((t) => `Upcoming: ${t}`),
    ...notes.map((t) => `Note: ${t}`),
    ...decks.map((t) => `Deck: ${t}`),
  ].slice(0, 12)

  const contextBlock = [
    courseLabel ? `Course: ${courseLabel}` : null,
    `Focus topic: ${topic}`,
    weak.length ? `Struggling topics: ${weak.join(", ")}` : null,
    mastery.length ? `Low mastery: ${mastery.join("; ")}` : null,
    upcoming.length ? `Upcoming: ${upcoming.join("; ")}` : null,
    notes.length ? `Existing notes: ${notes.join("; ")}` : null,
    decks.length ? `Flashcard decks: ${decks.join("; ")}` : null,
  ]
    .filter(Boolean)
    .join("\n")

  return { topic, courseLabel, sources, contextBlock }
}

export function formatStudyNotesPackMarkdown(pack: StudyNotesPack): string {
  const styleLabel =
    pack.style === "outline" ? "Outline" : pack.style === "exam" ? "Exam pack" : "Detailed"
  const generated = pack.generatedAt ? new Date(pack.generatedAt) : new Date()
  const dateLabel = Number.isNaN(generated.getTime())
    ? ""
    : generated.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })

  const lines: string[] = []
  lines.push(`# Cora Study Notes · ${pack.topic}`)
  lines.push("")
  lines.push(`**${pack.title}**`)
  lines.push("")
  lines.push(
    [
      pack.courseLabel ? `Course: **${pack.courseLabel}**` : null,
      `Style: **${styleLabel}**`,
      dateLabel ? `Generated: **${dateLabel}**` : null,
    ]
      .filter(Boolean)
      .join(" · "),
  )
  lines.push("")
  lines.push("> Exported from Cora workspace — organized Study Notes pack for My Notes.")
  lines.push("")

  lines.push("## Contents")
  lines.push("")
  for (const section of pack.sections) {
    const phase = STUDY_NOTES_PHASE_LABELS[section.phase]
    lines.push(`${section.index + 1}. **${section.title}** · _${phase}_`)
  }
  lines.push("")

  if (pack.sources.length) {
    lines.push("## CourseCollab signals used")
    lines.push("")
    for (const s of pack.sources) lines.push(`- ${s}`)
    lines.push("")
  }

  lines.push("---")
  lines.push("")

  const checkpoints: string[] = []
  for (const section of pack.sections) {
    const phase = STUDY_NOTES_PHASE_LABELS[section.phase]
    lines.push(`## ${section.index + 1}. ${section.title}`)
    lines.push("")
    lines.push(`**Phase:** ${phase}`)
    lines.push("")
    lines.push(section.body.trim())
    lines.push("")
    if (section.checkpoint?.trim()) {
      checkpoints.push(section.checkpoint.trim())
      lines.push("> **Checkpoint**")
      lines.push(">")
      lines.push(`> ${section.checkpoint.trim()}`)
      lines.push("")
    }
    lines.push("---")
    lines.push("")
  }

  if (checkpoints.length) {
    lines.push("## Study checklist")
    lines.push("")
    for (const c of checkpoints) lines.push(`- [ ] ${c}`)
    lines.push("")
  }

  lines.push("## Quick recap")
  lines.push("")
  lines.push(
    `You covered **${pack.sections.length} sections** on **${pack.topic}**. Revisit weak checkpoints, then turn key bullets into flashcards if needed.`,
  )
  lines.push("")
  lines.push("_Generated by Cora Study Notes workspace_")
  return lines.join("\n").trim()
}

export function fallbackStudyNotesPack(input: {
  topic: string
  courseLabel?: string | null
  sources?: string[]
  style?: string | null
}): StudyNotesPack {
  const topic = input.topic
  return {
    title: `Study notes · ${topic}`,
    topic,
    courseLabel: input.courseLabel ?? null,
    sources: input.sources ?? [],
    style: input.style ?? "detailed",
    generatedAt: new Date().toISOString(),
    sections: [
      {
        id: "s1",
        index: 0,
        phase: "overview",
        title: `What ${topic} is about`,
        body: `**${topic}** is a core idea in your course. Use this walkthrough to build intuition, then formalize it, then check yourself.`,
        checkpoint: null,
      },
      {
        id: "s2",
        index: 1,
        phase: "core",
        title: "Key ideas",
        body: `- Define the main terms for **${topic}**\n- Know when to use it vs related methods\n- Write the governing relationships in your own words`,
        checkpoint: null,
      },
      {
        id: "s3",
        index: 2,
        phase: "example",
        title: "Worked mini-example",
        body: `Walk a short example for **${topic}**: set up → solve → interpret the result.`,
        checkpoint: null,
      },
      {
        id: "s4",
        index: 3,
        phase: "pitfalls",
        title: "Common mistakes",
        body: `- Mixing similar concepts\n- Skipping units / assumptions\n- Jumping to formulas without setup`,
        checkpoint: null,
      },
      {
        id: "s5",
        index: 4,
        phase: "check",
        title: "Quick check",
        body: `Pause and test yourself before moving on.`,
        checkpoint: `In one sentence, explain ${topic} and name one trap to avoid.`,
      },
      {
        id: "s6",
        index: 5,
        phase: "recap",
        title: "Recap",
        body: `You covered overview → core ideas → example → pitfalls → check for **${topic}**. Export these notes to My Notes when ready.`,
        checkpoint: null,
      },
    ],
  }
}
