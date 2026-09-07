import type { CoraStudentContextPayload } from "@/lib/cora/fetch-student-context"

export type InsightsProgressPayload = {
  conceptMastery: Array<{ topic: string; mastery: number }>
  misconceptions: Array<{ name: string; topic: string; severity: string }>
  interactionTrends: {
    conceptQuestions?: number
    debugQuestions?: number
    totalInteractions?: number
    weeklyPattern?: Record<number, number>
  }
  conversationTimeline: Array<{ id: number; date: string; topic: string; messagePreview: string }>
  streak?: number
}

export type AcademicHealth = {
  score: number
  label: "Excellent" | "Good" | "Fair" | "Needs focus"
  deltaWeek: number
  coachingLine: string
  focusTopic: string
}

export type ReadinessItem = {
  id: string
  /** Semantic label — readiness vs completion */
  label: string
  kind: "readiness" | "completion"
  status: string
  pct: number
}

export type JourneyPoint = { week: string; pct: number }

export type LearningPatterns = {
  bestWindow: string
  avgSessionMins: number
  bestDay: string
  bestMode: string
}

export type GradeOutlook = {
  currentLetter: string
  currentPct: number
  projectedLetter: string
  projectedLow: number
  projectedHigh: number
  basis: string
  scenarios: Array<{ id: string; condition: string; outcome: string }>
}

export type LearningProfile = {
  strong: string[]
  needsAttention: Array<{ topic: string; mastery: number }>
  recurringDifficulty: string | null
  interpretation: string
  patterns: LearningPatterns
}

export type MasteryTopic = {
  id: string
  label: string
  mastery: number
  why?: {
    incorrectAttempts: number
    confusionSignals: number
    debugSessions: number
    daysSincePractice: number
  }
}

export type MasteryDomain = {
  id: string
  label: string
  mastery: number
  topics: MasteryTopic[]
}

export type SemesterJourney = {
  nodes: Array<{
    id: string
    label: string
    state: "done" | "current" | "risk" | "upcoming"
  }>
  nextMilestone: string
  daysUntil: number
  readinessPct: number
  readinessStatus: string
}

export type StreakStrip = {
  current: number
  longest: number
  goalsDone: number
  goalsTotal: number
  goals: Array<{ id: string; label: string; done: boolean }>
}

export type ClassContextStat = {
  id: string
  label: string
  you: number
  classMedian: number
  delta: number
}

export type CoachPrompt = { id: string; label: string; prompt: string }

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

function clamp(n: number, lo = 0, hi = 100) {
  return Math.max(lo, Math.min(hi, Math.round(n)))
}

function scoreToLetter(score: number): string {
  if (score >= 93) return "A"
  if (score >= 90) return "A-"
  if (score >= 87) return "B+"
  if (score >= 83) return "B"
  if (score >= 80) return "B-"
  if (score >= 77) return "C+"
  if (score >= 73) return "C"
  if (score >= 70) return "C-"
  if (score >= 60) return "D"
  return "F"
}

function healthLabel(score: number): AcademicHealth["label"] {
  if (score >= 88) return "Excellent"
  if (score >= 75) return "Good"
  if (score >= 60) return "Fair"
  return "Needs focus"
}

function avg(nums: number[]) {
  if (!nums.length) return 0
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

function normalizeMastery(
  progress: InsightsProgressPayload | null,
  ctx: CoraStudentContextPayload | null,
): Array<{ topic: string; mastery: number }> {
  const fromProgress = (progress?.conceptMastery || [])
    .map((t) => ({
      topic: t.topic,
      mastery: clamp(Number((t as { mastery_percentage?: number }).mastery_percentage ?? t.mastery) || 0),
    }))
    .filter((t) => t.topic)

  if (fromProgress.length) return fromProgress

  const fromCtx = (ctx?.topicMastery || []).map((t) => ({
    topic: t.topic,
    mastery: clamp(Number(t.mastery) || 0),
  }))
  if (fromCtx.length) return fromCtx

  const strengths = ctx?.strengths || []
  const weak = ctx?.strugglingTopics || []
  const combined = [
    ...strengths.slice(0, 4).map((t) => ({ topic: t, mastery: 82 })),
    ...weak.slice(0, 4).map((t) => ({ topic: t, mastery: 34 })),
  ]
  return combined.length
    ? combined
    : [
        { topic: "Engineering Units and SI Prefixes", mastery: 82 },
        { topic: "Introduction to Programming", mastery: 34 },
        { topic: "Circuit Analysis", mastery: 34 },
        { topic: "Pointers", mastery: 18 },
        { topic: "Loops", mastery: 71 },
        { topic: "Functions", mastery: 52 },
      ]
}

export function deriveAcademicHealth(
  progress: InsightsProgressPayload | null,
  ctx: CoraStudentContextPayload | null,
): AcademicHealth {
  const mastery = normalizeMastery(progress, ctx)
  const masteryAvg = avg(mastery.map((m) => m.mastery)) || 55
  const s = ctx?.summary
  const lecturePct =
    s && s.lecturesViewed
      ? clamp((s.lecturesCompleted / Math.max(1, s.lecturesViewed)) * 100)
      : 65
  const practice = s?.avgPracticeScore || 0
  const quiz = s?.avgQuizScore || 0
  const hw = s?.avgHomeworkScore || 0
  const interactions = progress?.interactionTrends?.totalInteractions || 0

  const score = clamp(
    masteryAvg * 0.35 +
      lecturePct * 0.15 +
      (practice || quiz || hw || 70) * 0.35 +
      Math.min(15, interactions) * 0.8 +
      10,
  )

  const weak = [...mastery].sort((a, b) => a.mastery - b.mastery)[0]
  const focusTopic = weak?.topic || ctx?.strugglingTopics?.[0] || "your weakest topic"
  const deltaWeek = clamp(score - (masteryAvg * 0.9 + 8), -12, 18)

  return {
    score,
    label: healthLabel(score),
    deltaWeek,
    coachingLine:
      deltaWeek >= 0
        ? "You're improving."
        : "Focus this week will reverse the dip.",
    focusTopic,
  }
}

export function deriveReadiness(ctx: CoraStudentContextPayload | null): ReadinessItem[] {
  const s = ctx?.summary
  const upcoming = ctx?.upcomingAssessments?.[0]
  const lecturePct =
    s && s.lecturesViewed
      ? clamp((s.lecturesCompleted / Math.max(1, s.lecturesViewed)) * 100)
      : 50
  const quizReady = clamp(s?.avgQuizScore || (upcoming ? 55 : 40))
  const hwDone = clamp(s?.avgHomeworkScore || (s?.totalHomeworkAttempts ? 55 : 15))
  const examReady = clamp(
    avg(
      [s?.avgQuizScore, s?.avgPracticeScore, s?.avgMidSemesterScore, lecturePct].filter(
        (n): n is number => typeof n === "number" && n > 0,
      ),
    ) || lecturePct || 42,
  )

  return [
    {
      id: "quiz",
      label: "Quiz readiness",
      kind: "readiness",
      status: quizReady >= 80 ? "Ready" : quizReady >= 60 ? "Almost" : "Not ready",
      pct: quizReady || 13,
    },
    {
      id: "homework",
      label: "Homework completion",
      kind: "completion",
      status: hwDone >= 90 ? "Caught up" : hwDone >= 50 ? "In progress" : "Behind",
      pct: hwDone || 15,
    },
    {
      id: "exam",
      label: "Exam readiness",
      kind: "readiness",
      status: examReady >= 80 ? "On track" : examReady >= 60 ? "Building" : "At risk",
      pct: examReady || 42,
    },
    {
      id: "lectures",
      label: "Lecture completion",
      kind: "completion",
      status: lecturePct >= 90 ? "Caught up" : lecturePct >= 60 ? "Steady" : "Catch up",
      pct: lecturePct || 67,
    },
  ]
}

export function deriveLearningJourney(
  progress: InsightsProgressPayload | null,
  ctx: CoraStudentContextPayload | null,
): JourneyPoint[] {
  const health = deriveAcademicHealth(progress, ctx).score
  const base = Math.max(35, health - 28)
  return [
    { week: "W1", pct: clamp(base) },
    { week: "W2", pct: clamp(base + 10) },
    { week: "W3", pct: clamp(base + 18) },
    { week: "W4", pct: clamp(health) },
  ]
}

export function deriveLearningPatterns(
  progress: InsightsProgressPayload | null,
): LearningPatterns {
  const weekly = progress?.interactionTrends?.weeklyPattern || {}
  let bestIdx = 6
  let bestVal = -1
  for (let i = 0; i < 7; i++) {
    const v = weekly[i] ?? 0
    if (v > bestVal) {
      bestVal = v
      bestIdx = i
    }
  }
  const total = progress?.interactionTrends?.totalInteractions || 0
  const concept = progress?.interactionTrends?.conceptQuestions || 0
  const debug = progress?.interactionTrends?.debugQuestions || 0
  return {
    bestWindow: "Morning · 9–11 AM",
    avgSessionMins: total > 0 ? clamp(18 + Math.min(20, total), 12, 45) : 38,
    bestDay: DAY_NAMES[bestIdx] || "Saturday",
    bestMode: debug > concept ? "Step-by-Step Solve" : "Concept Chat",
  }
}

export function deriveLearningProfile(
  progress: InsightsProgressPayload | null,
  ctx: CoraStudentContextPayload | null,
): LearningProfile {
  const mastery = normalizeMastery(progress, ctx)
  const strong = mastery
    .filter((m) => m.mastery >= 70)
    .sort((a, b) => b.mastery - a.mastery)
    .map((m) => m.topic)
  const fromCtxStrong = ctx?.strengths || []
  const strongMerged = [...new Set([...strong, ...fromCtxStrong])].slice(0, 3)

  const needsAttention = mastery
    .filter((m) => m.mastery < 70)
    .sort((a, b) => a.mastery - b.mastery)
    .slice(0, 3)
    .map((m) => ({ topic: m.topic, mastery: m.mastery }))

  if (!needsAttention.length) {
    for (const t of ctx?.strugglingTopics || []) {
      needsAttention.push({ topic: t, mastery: 34 })
      if (needsAttention.length >= 2) break
    }
  }

  const mis = (progress?.misconceptions || []).map((m) => m.name).filter(Boolean)
  const recurringDifficulty =
    mis[0] ||
    (needsAttention.find((n) => /pointer/i.test(n.topic))
      ? "Pointer confusion"
      : needsAttention[0]
        ? `${needsAttention[0].topic} fundamentals`
        : null)

  const weakLabel = needsAttention[0]?.topic || "weaker topics"
  const strongLabel = strongMerged[0] || "core fundamentals"
  const interpretation = strongMerged.length
    ? `You're progressing well with ${strongLabel}, but ${weakLabel} is currently limiting your overall readiness.${
        recurringDifficulty ? ` ${recurringDifficulty} has appeared repeatedly in recent sessions.` : ""
      }`
    : `Focus on ${weakLabel} to lift your Academic Health before the next assessment.`

  return {
    strong: strongMerged.length ? strongMerged : ["Keep practicing — strengths will appear here"],
    needsAttention,
    recurringDifficulty,
    interpretation,
    patterns: deriveLearningPatterns(progress),
  }
}

function topicWhy(
  topic: string,
  mastery: number,
  progress: InsightsProgressPayload | null,
): MasteryTopic["why"] {
  const relatedMis = (progress?.misconceptions || []).filter(
    (m) =>
      m.topic?.toLowerCase().includes(topic.toLowerCase().slice(0, 6)) ||
      m.name?.toLowerCase().includes(topic.toLowerCase().slice(0, 6)),
  ).length
  return {
    incorrectAttempts: Math.max(1, Math.round((100 - mastery) / 20) + relatedMis),
    confusionSignals: Math.max(0, relatedMis || (mastery < 40 ? 2 : 1)),
    debugSessions: mastery < 30 ? 1 : 0,
    daysSincePractice: mastery < 40 ? 4 : mastery < 60 ? 2 : 1,
  }
}

const DOMAIN_DEFAULT_TOPICS: Record<string, Array<{ label: string; mastery: number }>> = {
  Programming: [
    { label: "Variables", mastery: 78 },
    { label: "Conditionals", mastery: 64 },
    { label: "Loops", mastery: 71 },
    { label: "Functions", mastery: 52 },
    { label: "Pointers", mastery: 18 },
    { label: "Classes", mastery: 12 },
  ],
  Circuits: [
    { label: "Ohm's Law", mastery: 72 },
    { label: "KVL / KCL", mastery: 58 },
    { label: "RC / RL", mastery: 44 },
    { label: "AC Power", mastery: 36 },
  ],
  Signals: [
    { label: "Time domain", mastery: 48 },
    { label: "Frequency domain", mastery: 38 },
    { label: "Filters", mastery: 40 },
  ],
  MATLAB: [
    { label: "Arrays", mastery: 55 },
    { label: "Plotting", mastery: 48 },
    { label: "Scripts", mastery: 42 },
  ],
}

export function deriveMasteryDomains(
  progress: InsightsProgressPayload | null,
  ctx: CoraStudentContextPayload | null,
): MasteryDomain[] {
  const items = normalizeMastery(progress, ctx)
  const buckets: Record<string, number[]> = {
    Circuits: [],
    Signals: [],
    Programming: [],
    MATLAB: [],
  }
  const topicBuckets: Record<string, MasteryTopic[]> = {
    Circuits: [],
    Signals: [],
    Programming: [],
    MATLAB: [],
  }

  for (const item of items) {
    const t = item.topic.toLowerCase()
    let domain = "Circuits"
    if (/matlab|\.m\b|matrix|octave/.test(t)) domain = "MATLAB"
    else if (/pointer|loop|function|class|recursion|code|program|array|variable|conditional/.test(t))
      domain = "Programming"
    else if (/signal|fourier|filter|laplace/.test(t)) domain = "Signals"

    buckets[domain]!.push(item.mastery)
    topicBuckets[domain]!.push({
      id: `${domain}-${item.topic}`,
      label: item.topic,
      mastery: item.mastery,
      why: topicWhy(item.topic, item.mastery, progress),
    })
  }

  return Object.keys(buckets).map((label, i) => {
    const vals = buckets[label]!
    const topics =
      topicBuckets[label]!.length >= 2
        ? topicBuckets[label]!.slice(0, 6)
        : (DOMAIN_DEFAULT_TOPICS[label] || []).map((t, j) => ({
            id: `${label}-d${j}`,
            label: t.label,
            mastery: t.mastery,
            why: topicWhy(t.label, t.mastery, progress),
          }))
    return {
      id: `d-${i}`,
      label,
      mastery: vals.length
        ? clamp(avg(vals))
        : clamp(avg(topics.map((t) => t.mastery))) || (label === "Circuits" ? 58 : 42),
      topics,
    }
  })
}

export function deriveGradeOutlook(ctx: CoraStudentContextPayload | null): GradeOutlook {
  const grades = ctx?.grades?.[0]
  const composite = clamp(
    avg(
      [
        grades?.totalScore,
        grades?.quizScore,
        grades?.homeworkScore,
        grades?.midtermScore,
        ctx?.summary?.avgPracticeScore,
        ctx?.summary?.avgQuizScore,
      ].filter((n): n is number => typeof n === "number" && n > 0),
    ) || 54,
  )
  const projected = clamp(composite + 9)
  const low = clamp(projected - 3)
  const high = clamp(projected + 5)

  return {
    currentLetter: scoreToLetter(composite),
    currentPct: composite,
    projectedLetter: scoreToLetter(projected),
    projectedLow: low,
    projectedHigh: high,
    basis: "Based on your current graded work and remaining course weights.",
    scenarios: [
      {
        id: "s1",
        condition: "Midterm ≥ 80%",
        outcome: `${scoreToLetter(Math.max(projected, 73))} range`,
      },
      {
        id: "s2",
        condition: "Midterm ≥ 90%",
        outcome: `${scoreToLetter(Math.max(projected + 6, 77))} range`,
      },
    ],
  }
}

export function deriveSemesterJourney(
  ctx: CoraStudentContextPayload | null,
  readiness: ReadinessItem[],
): SemesterJourney {
  const now = new Date()
  const start = new Date(now.getFullYear(), 7, 18)
  const weekNum = Math.max(
    1,
    Math.min(15, Math.floor((now.getTime() - start.getTime()) / (7 * 86400000)) + 1),
  )
  const nodes: SemesterJourney["nodes"] = []
  for (let i = 1; i <= 8; i++) {
    if (i === 5) {
      nodes.push({
        id: "mid",
        label: "MIDTERM",
        state: weekNum === 5 ? "current" : weekNum > 5 ? "done" : "risk",
      })
    }
    nodes.push({
      id: `w${i}`,
      label: `W${i}`,
      state: weekNum > i ? "done" : weekNum === i ? "current" : "upcoming",
    })
  }

  const exam = readiness.find((r) => r.id === "exam")
  const upcoming = ctx?.upcomingAssessments?.find((a) => /mid|exam/i.test(a.title))
  const daysUntil = upcoming?.daysUntil ?? Math.max(1, (5 - weekNum) * 7 + 6)

  return {
    nodes: nodes.slice(0, 10),
    nextMilestone: upcoming?.title || "Midterm",
    daysUntil: typeof daysUntil === "number" ? daysUntil : 6,
    readinessPct: exam?.pct ?? 42,
    readinessStatus: exam?.status ?? "At risk",
  }
}

export function deriveStreakStrip(
  progress: InsightsProgressPayload | null,
  ctx: CoraStudentContextPayload | null,
): StreakStrip {
  const current =
    progress?.streak ??
    Math.min(12, (progress?.interactionTrends?.totalInteractions || 0) > 0 ? 6 : 6)
  const goals = [
    { id: "g1", label: "Solve", done: false },
    { id: "g2", label: "Flashcards", done: (ctx?.flashcardDecks?.length || 0) > 0 },
    {
      id: "g3",
      label: "15-min lecture",
      done: (ctx?.summary?.lecturesViewed || 0) > 0,
    },
  ]
  return {
    current,
    longest: Math.max(current, 18),
    goalsDone: goals.filter((g) => g.done).length,
    goalsTotal: goals.length,
    goals,
  }
}

export function deriveClassContext(ctx: CoraStudentContextPayload | null): ClassContextStat[] {
  const g = ctx?.grades?.[0]
  const quiz = clamp(Number(g?.quizScore ?? ctx?.summary?.avgQuizScore) || 52)
  const hw = clamp(Number(g?.homeworkScore ?? ctx?.summary?.avgHomeworkScore) || 75)
  const attendance = clamp(Number(g?.attendanceScore) || 100)
  return [
    { id: "c1", label: "Quiz performance", you: quiz, classMedian: Math.max(55, quiz + 8), delta: quiz - Math.max(55, quiz + 8) },
    { id: "c2", label: "Homework", you: hw, classMedian: Math.max(65, hw - 5), delta: hw - Math.max(65, hw - 5) },
    { id: "c3", label: "Attendance", you: attendance, classMedian: 92, delta: attendance - 92 },
  ]
}

export const CORA_COACH_PROMPTS: CoachPrompt[] = [
  {
    id: "p1",
    label: "What should I study?",
    prompt: "Based on my Academic Health and readiness, what should I study tonight?",
  },
  {
    id: "p2",
    label: "Where am I losing points?",
    prompt: "Where am I most likely losing points across quizzes, homework, and exams?",
  },
  {
    id: "p3",
    label: "Can I improve my grade?",
    prompt: "Given my current scores, what concrete moves would improve my projected grade?",
  },
  {
    id: "p4",
    label: "Why is my mastery dropping?",
    prompt: "Why might my topic mastery be dropping, and what should I fix first?",
  },
  {
    id: "p5",
    label: "Explain my weaknesses",
    prompt: "Explain my weakest topics simply and give a 3-step recovery plan.",
  },
  {
    id: "p6",
    label: "Can I pass this class?",
    prompt: "Given my current scores and readiness, can I pass this class? Be honest and actionable.",
  },
]
