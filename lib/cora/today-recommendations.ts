import type { CoraStudentContextPayload } from "@/lib/cora/fetch-student-context"
import type { CoraPlatformTab } from "@/lib/cora/platform-nav"

export const CORA_TODAY_LINK_CHAT = "cora:chat"
export const CORA_TODAY_LINK_PREPARE_EXAM = "cora:prepare-exam"
export const CORA_TODAY_LINK_STUDY_PLAN = "cora:study-plan"
export const CORA_TODAY_LINK_SUMMARIZE = "cora:summarize-lecture"

const MAX_TODAY_ITEMS = 12
const UPCOMING_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

export type CoraTodayRecommendation = {
  id: string
  title: string
  description: string
  link: string
  priority?: string
}

export type StudentCoraTodayInput = {
  payload: CoraStudentContextPayload | null | undefined
  apiRecommendations?: CoraTodayRecommendation[]
}

function item(id: string, title: string, description: string, link: string): CoraTodayRecommendation {
  return { id, title, description, link, priority: "medium" }
}

function dedupeKey(rec: CoraTodayRecommendation): string {
  return rec.id || rec.title.trim().toLowerCase()
}

function fallbackRecommendations(courseCode?: string | null): CoraTodayRecommendation[] {
  const course = courseCode?.trim() || "your course"
  return [
    item(
      "fallback-solve",
      "Start with Solve",
      "Paste a homework or quiz question for step-by-step help.",
      CORA_TODAY_LINK_CHAT,
    ),
    item(
      "fallback-practice",
      "Open Practice Hub",
      `Work through ${course} topics with guided mode.`,
      "/student/dashboard-v2/practice",
    ),
    item(
      "fallback-learn",
      "Review lectures",
      "Summarize slides and sample problems with Cora.",
      "/student/dashboard-v2/lectures",
    ),
  ]
}

function collectWeakTopics(payload: CoraStudentContextPayload): string[] {
  const fromStruggling = payload.strugglingTopics ?? []
  const fromMastery =
    payload.topicMastery
      ?.filter((row) => row.status === "weak" || row.mastery < 0.55)
      .map((row) => row.topic) ?? []
  const seen = new Set<string>()
  const result: string[] = []
  for (const topic of [...fromStruggling, ...fromMastery]) {
    const key = topic.trim().toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    result.push(topic.trim())
  }
  return result
}

/** Merge platform API picks with live student-context signals. */
export function buildStudentCoraTodayRecommendations(
  input: StudentCoraTodayInput,
): CoraTodayRecommendation[] {
  const { payload, apiRecommendations = [] } = input
  const merged: CoraTodayRecommendation[] = []
  const seen = new Set<string>()

  const push = (rec: CoraTodayRecommendation) => {
    const key = dedupeKey(rec)
    if (seen.has(key)) return
    seen.add(key)
    merged.push(rec)
  }

  if (!payload) {
    for (const rec of apiRecommendations) push(rec)
    if (merged.length >= 3) return merged.slice(0, MAX_TODAY_ITEMS)
    for (const rec of fallbackRecommendations()) push(rec)
    return merged.slice(0, MAX_TODAY_ITEMS)
  }

  const courseCode = payload.account?.courseCode ?? null
  const now = Date.now()

  for (const assessment of (payload.missedDeadlines ?? []).slice(0, 2)) {
    push(
      item(
        `missed-${assessment.id}`,
        `Catch up on ${assessment.title}`,
        `This ${assessment.type ?? "assignment"} is past due — Cora can help you recover.`,
        CORA_TODAY_LINK_CHAT,
      ),
    )
  }

  for (const assessment of payload.upcomingAssessments ?? []) {
    const dueMs = assessment.dueDate ? new Date(assessment.dueDate).getTime() : NaN
    if (!Number.isFinite(dueMs) || dueMs < now || dueMs - now > UPCOMING_WINDOW_MS) continue
    const days = Math.max(1, Math.ceil((dueMs - now) / (24 * 60 * 60 * 1000)))
    push(
      item(
        `upcoming-${assessment.id}`,
        `Prepare for ${assessment.title}`,
        `Due in ~${days} day${days === 1 ? "" : "s"} — start a focused review with Cora.`,
        CORA_TODAY_LINK_PREPARE_EXAM,
      ),
    )
  }

  for (const topic of collectWeakTopics(payload).slice(0, 2)) {
    push(
      item(
        `weak-${topic.toLowerCase().replace(/\s+/g, "-")}`,
        `Strengthen ${topic}`,
        `Practice guided questions and get Cora feedback on ${courseCode ?? "this topic"}.`,
        "/student/dashboard-v2/practice",
      ),
    )
  }

  const lecture =
    payload.knowledgeGraph?.lectures?.[0] ??
    (payload.digitalNotes?.[0]
      ? { id: payload.digitalNotes[0].id, title: payload.digitalNotes[0].title }
      : null)
  if (lecture?.title) {
    push(
      item(
        `lecture-${lecture.id}`,
        `Summarize ${lecture.title}`,
        "Turn this lecture into exam-ready notes and a glossary with Cora.",
        CORA_TODAY_LINK_SUMMARIZE,
      ),
    )
  }

  const deck = payload.flashcardDecks?.[0]
  if (deck) {
    const countLabel =
      typeof deck.cardCount === "number" ? `${deck.cardCount} cards` : "Your deck"
    push(
      item(
        `deck-${deck.id}`,
        `Study ${deck.title}`,
        `${countLabel} ready — review or ask Cora to explain tricky cards.`,
        "/student/dashboard-v2/practice",
      ),
    )
  }

  const nextStudyEvent = (payload.calendarEvents ?? []).find((event) => {
    const startMs = event.start ? new Date(event.start).getTime() : NaN
    return Number.isFinite(startMs) && startMs >= now && startMs - now <= UPCOMING_WINDOW_MS
  })
  if (nextStudyEvent?.title) {
    push(
      item(
        `calendar-${nextStudyEvent.id}`,
        `Plan around ${nextStudyEvent.title}`,
        "Build a realistic study schedule with Cora before this commitment.",
        CORA_TODAY_LINK_STUDY_PLAN,
      ),
    )
  }

  for (const rec of apiRecommendations) push(rec)
  if (merged.length < 3) {
    for (const rec of fallbackRecommendations(courseCode)) push(rec)
  }

  return merged.slice(0, MAX_TODAY_ITEMS)
}

export function resolveCoraTodayLink(
  link: string,
): { kind: "tab"; tab: CoraPlatformTab; toolId?: string } | { kind: "href"; href: string } {
  if (link === CORA_TODAY_LINK_CHAT) return { kind: "tab", tab: "workspace" }
  if (link === CORA_TODAY_LINK_PREPARE_EXAM) return { kind: "tab", tab: "study-plan" }
  if (link === CORA_TODAY_LINK_STUDY_PLAN) return { kind: "tab", tab: "study-plan" }
  if (link === CORA_TODAY_LINK_SUMMARIZE) return { kind: "tab", tab: "learn" }
  if (link.startsWith("/")) return { kind: "href", href: link }
  return { kind: "tab", tab: "workspace" }
}
