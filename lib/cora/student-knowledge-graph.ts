/** Structured student context graph built from CourseCollab data for Cora. */

export type KnowledgeTopicNode = {
  id: string
  label: string
  status: "weak" | "strong" | "neutral"
  mastery?: number
  sources: string[]
}

export type KnowledgeAssessmentNode = {
  id: string
  title: string
  type: string
  dueDate?: string | null
  opensAt?: string | null
  status: "open" | "past_due" | "completed" | "coming_soon"
}

export type KnowledgeCalendarNode = {
  id: string
  title: string
  start: string
  end?: string | null
  eventType?: string | null
  isCompleted?: boolean
}

export type KnowledgeLectureNode = {
  id: string
  title: string
  week?: number | null
  status?: string | null
  lastAccessed?: string | null
}

export type StudentKnowledgeGraph = {
  updatedAt: string
  topics: KnowledgeTopicNode[]
  assessments: KnowledgeAssessmentNode[]
  calendar: KnowledgeCalendarNode[]
  lectures: KnowledgeLectureNode[]
  notifications: { id: number; title: string; type?: string; isRead: boolean; createdAt: string }[]
  summary: string
}

type RawStudentContext = {
  strugglingTopics?: string[]
  strengths?: string[]
  topicMastery?: { topic: string; mastery: number; status?: string }[]
  summary?: Record<string, number>
  upcomingAssessments?: KnowledgeAssessmentNode[]
  missedDeadlines?: KnowledgeAssessmentNode[]
  calendarEvents?: KnowledgeCalendarNode[]
  lectureProgress?: {
    lecture_id: number
    title: string
    status?: string
    last_accessed?: string
    week?: number
  }[]
  notifications?: {
    id: number
    title: string
    type?: string
    is_read?: boolean
    created_at?: string
  }[]
}

export function buildStudentKnowledgeGraph(raw: RawStudentContext): StudentKnowledgeGraph {
  const weak = new Set(raw.strugglingTopics ?? [])
  const strong = new Set(raw.strengths ?? [])
  const topicMap = new Map<string, KnowledgeTopicNode>()

  for (const topic of [...weak, ...strong]) {
    if (!topic?.trim()) continue
    const id = `topic:${topic.toLowerCase()}`
    topicMap.set(id, {
      id,
      label: topic,
      status: weak.has(topic) ? "weak" : "strong",
      sources: weak.has(topic) ? ["performance"] : ["performance"],
    })
  }

  for (const row of raw.topicMastery ?? []) {
    if (!row.topic?.trim()) continue
    const id = `topic:${row.topic.toLowerCase()}`
    const status =
      row.mastery >= 80 ? "strong" : row.mastery < 70 ? "weak" : "neutral"
    topicMap.set(id, {
      id,
      label: row.topic,
      status,
      mastery: row.mastery,
      sources: ["mastery"],
    })
  }

  const lectures: KnowledgeLectureNode[] = (raw.lectureProgress ?? []).map((row) => ({
    id: `lecture:${row.lecture_id}`,
    title: row.title,
    week: row.week ?? null,
    status: row.status ?? null,
    lastAccessed: row.last_accessed ?? null,
  }))

  const assessments = [
    ...(raw.upcomingAssessments ?? []),
    ...(raw.missedDeadlines ?? []).map((a) => ({ ...a, status: "past_due" as const })),
  ]

  const calendar = raw.calendarEvents ?? []

  const notifications = (raw.notifications ?? []).map((n) => ({
    id: n.id,
    title: n.title,
    type: n.type,
    isRead: n.is_read === true,
    createdAt: n.created_at ?? new Date().toISOString(),
  }))

  const summaryParts: string[] = []
  const weakTopics = [...topicMap.values()].filter((t) => t.status === "weak")
  if (weakTopics.length > 0) {
    summaryParts.push(`Focus areas: ${weakTopics.slice(0, 5).map((t) => t.label).join(", ")}`)
  }
  const dueSoon = assessments.filter((a) => a.status === "open" || a.status === "coming_soon")
  if (dueSoon.length > 0) {
    summaryParts.push(`${dueSoon.length} upcoming assessment(s)`)
  }
  const missed = assessments.filter((a) => a.status === "past_due")
  if (missed.length > 0) {
    summaryParts.push(`${missed.length} missed deadline(s)`)
  }
  if (calendar.length > 0) {
    summaryParts.push(`${calendar.length} calendar event(s) in range`)
  }

  return {
    updatedAt: new Date().toISOString(),
    topics: [...topicMap.values()],
    assessments,
    calendar,
    lectures,
    notifications,
    summary: summaryParts.join(" · ") || "Learning profile synced from CourseCollab.",
  }
}

export function formatKnowledgeGraphForPrompt(graph: StudentKnowledgeGraph): string {
  const lines: string[] = ["**STUDENT KNOWLEDGE GRAPH (CourseCollab, live database):**"]

  if (graph.topics.length > 0) {
    const weak = graph.topics.filter((t) => t.status === "weak").slice(0, 8)
    const strong = graph.topics.filter((t) => t.status === "strong").slice(0, 5)
    if (weak.length) lines.push(`- Weak topics: ${weak.map((t) => t.label).join(", ")}`)
    if (strong.length) lines.push(`- Strengths: ${strong.map((t) => t.label).join(", ")}`)
  } else {
    lines.push("- Topics: none tracked yet")
  }

  const upcoming = graph.assessments.filter((a) => a.status !== "past_due").slice(0, 8)
  if (upcoming.length) {
    lines.push("- Upcoming assessments:")
    upcoming.forEach((a) => {
      lines.push(`  • ${a.title} (${a.type})${a.dueDate ? ` — due ${a.dueDate}` : ""}`)
    })
  } else {
    lines.push("- Upcoming assessments: none on record")
  }

  const missed = graph.assessments.filter((a) => a.status === "past_due").slice(0, 6)
  if (missed.length) {
    lines.push("- Missed / past-due:")
    missed.forEach((a) => {
      lines.push(`  • ${a.title} (${a.type})${a.dueDate ? ` — was due ${a.dueDate}` : ""}`)
    })
  } else {
    lines.push("- Missed deadlines: none on record")
  }

  if (graph.calendar.length > 0) {
    lines.push("- Calendar events:")
    graph.calendar.slice(0, 12).forEach((e) => {
      lines.push(`  • ${e.title} — ${e.start}${e.eventType ? ` (${e.eventType})` : ""}${e.isCompleted ? " [done]" : ""}`)
    })
  } else {
    lines.push("- Calendar events: none in the next 90 days")
  }

  if (graph.lectures.length > 0) {
    lines.push("- Recent lectures:")
    graph.lectures.slice(0, 6).forEach((l) => {
      lines.push(`  • ${l.title}${l.week != null ? ` (Week ${l.week})` : ""} — ${l.status ?? "unknown"}`)
    })
  }

  const unread = graph.notifications.filter((n) => !n.isRead).slice(0, 8)
  if (unread.length) {
    lines.push("- Unread alerts:")
    unread.forEach((n) => lines.push(`  • ${n.title}`))
  } else if (graph.notifications.length > 0) {
    lines.push("- Alerts: all read (no unread notifications)")
  } else {
    lines.push("- Alerts: none on record")
  }

  lines.push(`- Synced: ${graph.updatedAt}`)
  return lines.join("\n")
}
