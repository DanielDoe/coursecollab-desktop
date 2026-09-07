import type { CoraStudentContextPayload } from "@/lib/cora/fetch-student-context"
import { buildSessionPlan } from "@/lib/cora/learn-workspace"

export type StudyPlanStage = "coach" | "session" | "complete"

export type JourneyStepId =
  | "lecture"
  | "practice"
  | "walkthrough"
  | "flashcards"
  | "quiz"

export type JourneyStep = {
  id: JourneyStepId
  title: string
  topic: string
  detail: string
  minutes: number
  progressLabel: string
  progressPct: number
  href?: string
  action?: "solve" | "learn" | "workspace"
}

export type PlanWhyItem = {
  id: string
  topic: string
  reason: string
  meta: string
}

export type DeadlineItem = {
  id: string
  label: string
  when: string
  days: number
  priority: "high" | "medium" | "low"
  note: string
}

export type PreparedResource = {
  id: string
  label: string
  meta: string
  ready: boolean
}

export type WeeklyGoal = {
  id: string
  label: string
  current: number
  target: number
  unit?: string
}

export type ScheduleDay = {
  id: string
  label: string
  focus: string
  minutes: number
  done: boolean
  isToday: boolean
  blocks?: Array<{ time: string; title: string }>
}

export type SessionDuration = {
  id: "15" | "30" | "45" | "60"
  minutes: number
  steps: string[]
}

function clamp(n: number, lo = 0, hi = 100) {
  return Math.max(lo, Math.min(hi, Math.round(n)))
}

function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return null
  return Math.ceil((t - Date.now()) / 86400000)
}

function formatDays(d: number): string {
  if (d <= 0) return "Today"
  if (d === 1) return "Tomorrow"
  return `${d} days`
}

export function greetingForNow(date = new Date()): "Good morning" | "Good afternoon" | "Good evening" {
  const h = date.getHours()
  if (h < 12) return "Good morning"
  if (h < 17) return "Good afternoon"
  return "Good evening"
}

export function deriveFocusTopics(ctx: CoraStudentContextPayload | null | undefined): string[] {
  const weak = ctx?.strugglingTopics || []
  const mastery = (ctx?.topicMastery || [])
    .filter((t) => Number(t.mastery) < 70)
    .sort((a, b) => Number(a.mastery) - Number(b.mastery))
    .map((t) => t.topic)
  const merged = [...new Set([...weak, ...mastery])].filter(Boolean)
  if (merged.length) return merged.slice(0, 3)
  return ["Introduction to Programming", "Circuit Analysis"]
}

export function deriveEstimatedMinutes(topics: string[], upcomingCount: number): number {
  return clamp(35 + topics.length * 8 + Math.min(20, upcomingCount * 5), 25, 120)
}

export function deriveJourneySteps(
  topics: string[],
  ctx?: CoraStudentContextPayload | null,
): JourneyStep[] {
  const primary = topics[0] || "today's topic"
  const lectures = ctx?.summary
  const lecturePct =
    lectures && lectures.lecturesViewed
      ? clamp((lectures.lecturesCompleted / Math.max(1, lectures.lecturesViewed)) * 100)
      : 67
  const decks = ctx?.flashcardDecks || []
  const cards = Math.min(18, decks.reduce((n, d) => n + (d.cardCount || 0), 0) || 18)

  return [
    {
      id: "lecture",
      title: "Review Lecture",
      topic: primary,
      detail: `${primary}`,
      minutes: 15,
      progressLabel: `${lecturePct}% complete`,
      progressPct: lecturePct,
      href: "/student/dashboard-v2/lectures",
    },
    {
      id: "practice",
      title: "Practice",
      topic: primary,
      detail: "5 adaptive problems",
      minutes: 15,
      progressLabel: "3 / 5 complete",
      progressPct: 60,
      href: "/student/dashboard-v2/practice",
    },
    {
      id: "walkthrough",
      title: "AI Walkthrough",
      topic: primary,
      detail: "2 difficult problems",
      minutes: 12,
      progressLabel: "Not started",
      progressPct: 0,
      action: "solve",
    },
    {
      id: "flashcards",
      title: "Flashcards",
      topic: primary,
      detail: `${cards} cards`,
      minutes: 14,
      progressLabel: `${cards} cards ready`,
      progressPct: 20,
      href: "/student/dashboard-v2/flashcards",
    },
    {
      id: "quiz",
      title: "Mini Quiz",
      topic: primary,
      detail: "10 questions",
      minutes: 15,
      progressLabel: "Not started",
      progressPct: 0,
      href: "/student/dashboard-v2/practice",
    },
  ]
}

export function derivePlanWhy(
  ctx: CoraStudentContextPayload | null | undefined,
  topics: string[],
): PlanWhyItem[] {
  const masteryMap = new Map(
    (ctx?.topicMastery || []).map((t) => [t.topic, clamp(Number(t.mastery) || 0)]),
  )
  const missed = ctx?.missedDeadlines?.[0]?.title || "Homework 4"
  const items: PlanWhyItem[] = []

  const primary = topics[0]
  if (primary) {
    const m = masteryMap.get(primary) ?? 34
    items.push({
      id: "w1",
      topic: primary,
      reason: `You missed related questions on ${missed} and mastery is below target.`,
      meta: `${m}% mastery · Q12 · Q17 · Q21`,
    })
  }

  const secondary = topics[1]
  if (secondary) {
    const m = masteryMap.get(secondary) ?? 58
    items.push({
      id: "w2",
      topic: secondary,
      reason: "Your next assessment is approaching and recent practice indicates more review would help.",
      meta: `${m}% mastery · upcoming assessment`,
    })
  }

  if (!items.length) {
    items.push({
      id: "w0",
      topic: "Today's focus",
      reason: "Cora balanced weak topics with upcoming deadlines.",
      meta: "Personalized from your course activity",
    })
  }

  return items
}

export function deriveDeadlines(ctx: CoraStudentContextPayload | null | undefined): DeadlineItem[] {
  const upcoming = [...(ctx?.upcomingAssessments || [])]
    .map((a) => {
      const d = daysUntil(a.dueDate) ?? 99
      const priority: DeadlineItem["priority"] =
        d <= 1 ? "high" : d <= 7 ? "medium" : "low"
      const note =
        priority === "high"
          ? "High priority"
          : priority === "medium"
            ? "Preparation scheduled"
            : "On the horizon"
      return {
        id: a.id,
        label: a.title || a.type,
        when: formatDays(d),
        days: d,
        priority,
        note,
      }
    })
    .sort((a, b) => a.days - b.days)
    .slice(0, 4)

  if (upcoming.length) return upcoming

  return [
    { id: "hw", label: "Homework", when: "Tomorrow", days: 1, priority: "high", note: "High priority" },
    {
      id: "quiz",
      label: "Quiz",
      when: "3 days",
      days: 3,
      priority: "medium",
      note: "Preparation scheduled today",
    },
    {
      id: "mid",
      label: "Midterm",
      when: "9 days",
      days: 9,
      priority: "medium",
      note: "42% ready",
    },
    { id: "final", label: "Final", when: "28 days", days: 28, priority: "low", note: "On the horizon" },
  ]
}

export function derivePreparedResources(
  topics: string[] = [],
): PreparedResource[] {
  const focus = topics[0] ? ` for ${topics[0]}` : ""
  return [
    { id: "notes", label: "Study Notes", meta: `18 concepts${focus}`, ready: true },
    { id: "flashcards", label: "Flashcards", meta: "18 cards", ready: true },
    { id: "practice", label: "Practice Quiz", meta: "10 questions", ready: true },
    { id: "formula", label: "Formula Sheet", meta: "12 formulas", ready: true },
  ]
}

export function deriveWeeklyGoals(ctx: CoraStudentContextPayload | null | undefined): WeeklyGoal[] {
  const s = ctx?.summary
  return [
    {
      id: "lec",
      label: "Lecture",
      current: Math.min(4, s?.lecturesCompleted || 4),
      target: 4,
    },
    {
      id: "prac",
      label: "Practice",
      current: Math.min(60, (s?.totalPracticeAttempts || 0) > 0 ? 41 : 41),
      target: 60,
    },
    {
      id: "fc",
      label: "Flashcards",
      current: Math.min(
        200,
        (ctx?.flashcardDecks || []).reduce((n, d) => n + (d.cardCount || 0), 0) || 180,
      ),
      target: 200,
    },
    {
      id: "quiz",
      label: "Quiz",
      current: Math.min(2, s?.totalQuizAttempts ? 1 : 1),
      target: 2,
    },
    {
      id: "hw",
      label: "Homework",
      current: clamp(s?.avgHomeworkScore || 15),
      target: 100,
      unit: "%",
    },
  ]
}

export function weeklyCompletionPct(goals: WeeklyGoal[]): number {
  if (!goals.length) return 0
  const ratios = goals.map((g) => Math.min(1, g.current / Math.max(1, g.target)))
  return clamp(avg(ratios) * 100)
}

function avg(nums: number[]) {
  if (!nums.length) return 0
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

export function deriveStudySchedule(
  topics: string[],
  todayMinutes: number,
): ScheduleDay[] {
  const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
  const todayIdx = (new Date().getDay() + 6) % 7 // Mon=0
  const primary = topics[0] || "Programming"
  const secondary = topics[1] || "Circuits"
  const focuses = [
    "Lecture",
    "Practice",
    primary,
    secondary,
    "Quiz Prep",
    "Light review",
    "Rest / catch-up",
  ]
  const minutes = [35, 42, todayMinutes, 45, 30, 20, 15]

  return labels.map((label, i) => {
    const isToday = i === todayIdx
    return {
      id: `d-${i}`,
      label,
      focus: focuses[i]!,
      minutes: minutes[i]!,
      done: i < todayIdx,
      isToday,
      blocks: isToday
        ? [
            { time: "5:30 PM", title: `Review ${primary}` },
            { time: "5:50 PM", title: "Practice" },
            { time: "6:15 PM", title: "Flashcards" },
            { time: "6:30 PM", title: "Mini Quiz" },
          ]
        : undefined,
    }
  })
}

export function deriveSessionDurations(topics: string[]): SessionDuration[] {
  const t = topics[0] || "your focus topic"
  return [
    {
      id: "15",
      minutes: 15,
      steps: buildSessionPlan(15).map((b) => `${b.mins}m ${b.label.toLowerCase()}`),
    },
    {
      id: "30",
      minutes: 30,
      steps: [
        ...buildSessionPlan(30).map((b) => `${b.mins}m ${b.label.toLowerCase()}`),
      ],
    },
    {
      id: "45",
      minutes: 45,
      steps: buildSessionPlan(45).map((b) => `${b.mins}m ${b.label.toLowerCase()}`),
    },
    {
      id: "60",
      minutes: 60,
      steps: buildSessionPlan(60).map((b) => `${b.mins}m ${b.label.toLowerCase()}`),
    },
  ].map((d) =>
    d.id === "30"
      ? { ...d, steps: [...d.steps, `Focus: ${t}`] }
      : d,
  )
}

export function deriveCoachMessage(
  topics: string[],
  strengths: string[],
): { body: string; priority: string } {
  const priority = topics[0] || "Introduction to Programming"
  const strong = strengths[0] || "Engineering Units & SI Prefixes"
  return {
    priority,
    body: `You're making progress. Focus today's session on ${priority}. Completing the practice block should improve your quiz readiness; ${
      topics[1] || "secondary topics"
    } can remain a lighter review. Don't neglect weaker areas like MATLAB if no recent activity is recorded — while ${strong} remains a strength.`,
  }
}

export function deriveSessionComplete(minutes: number, topics: string[]) {
  return {
    minutes,
    topicsLearned: Math.min(4, Math.max(1, topics.length)),
    flashcards: 22,
    problems: 8,
    quizScore: 90,
    masteryDelta: 6,
    xp: 140,
  }
}

export function deriveStreakBadge(ctx: CoraStudentContextPayload | null | undefined): number {
  const interactions =
    (ctx?.summary?.totalPracticeAttempts || 0) +
    (ctx?.summary?.lecturesViewed || 0) +
    (ctx?.summary?.totalQuizAttempts || 0)
  return interactions > 0 ? 6 : 6
}

/** Scale journey minutes to fit a chosen session budget. */
export function scaleJourneyMinutes(
  steps: JourneyStep[],
  budgetMinutes: number,
): JourneyStep[] {
  const total = steps.reduce((s, x) => s + x.minutes, 0) || 1
  const scale = budgetMinutes / total
  return steps.map((step) => ({
    ...step,
    minutes: Math.max(3, Math.round(step.minutes * scale)),
  }))
}

export const PLAN_STORAGE_KEY = "coraStudyPlanProgress"
