/** Structured Cora Insights taxonomy — operational labels, not LLM conclusions. */

export const CORA_INTERACTION_CATEGORIES = [
  "concept_explanation",
  "hint_guided",
  "debugging",
  "code_understanding",
  "practice",
  "study_planning",
  "lecture_clarification",
  "assessment_help",
  "circuit_analysis",
  "writing_explanation",
  "career_help",
  "answer_seeking",
  "other",
] as const

export type CoraInteractionCategory = (typeof CORA_INTERACTION_CATEGORIES)[number]

export const CATEGORY_LABELS: Record<CoraInteractionCategory, string> = {
  concept_explanation: "Concept Explanation",
  hint_guided: "Hint / Guided Problem Solving",
  debugging: "Debugging",
  code_understanding: "Code Understanding",
  practice: "Practice",
  study_planning: "Study Planning",
  lecture_clarification: "Lecture Clarification",
  assessment_help: "Assessment Help",
  circuit_analysis: "Circuit Analysis Guidance",
  writing_explanation: "Writing / Explanation",
  career_help: "Career Help",
  answer_seeking: "Answer-Seeking Attempt",
  other: "Other",
}

export const ASSISTANCE_LEVELS = [0, 1, 2, 3, 4, 5] as const
export type AssistanceLevel = (typeof ASSISTANCE_LEVELS)[number]

export const ASSISTANCE_LEVEL_LABELS: Record<AssistanceLevel, string> = {
  0: "L0 — No Cora",
  1: "L1 — Concept clarification",
  2: "L2 — Light hint",
  3: "L3 — Guided reasoning",
  4: "L4 — Multiple / scaffolded hints",
  5: "L5 — Extensive guided assistance",
}

export const ASSISTANCE_LEVEL_SHORT: Record<AssistanceLevel, string> = {
  0: "No Cora",
  1: "Concept clarification",
  2: "Light hint",
  3: "Guided",
  4: "Scaffolded",
  5: "Extensive",
}

export const DEPENDENCE_LABELS = [
  "increasing_independence",
  "stable_assistance",
  "high_assistance_need",
  "insufficient_evidence",
] as const

export type DependenceLabel = (typeof DEPENDENCE_LABELS)[number]

export const DEPENDENCE_COPY: Record<DependenceLabel, string> = {
  increasing_independence: "Increasing Independence",
  stable_assistance: "Stable Assistance",
  high_assistance_need: "High Assistance Need",
  insufficient_evidence: "Insufficient Evidence",
}

export const HEALTH_BANDS = ["strong", "developing", "struggling", "critical"] as const
export type HealthBand = (typeof HEALTH_BANDS)[number]

export const HEALTH_LABELS: Record<HealthBand, string> = {
  strong: "Strong",
  developing: "Developing",
  struggling: "Struggling",
  critical: "Critical",
}

export const RISK_LEVELS = ["high", "medium", "low", "watch"] as const
export type RiskLevel = (typeof RISK_LEVELS)[number]

export const DATE_PRESETS = ["today", "7d", "30d", "semester", "custom"] as const
export type DatePreset = (typeof DATE_PRESETS)[number]

export const LIVE_EVENT_FILTERS = ["all", "cora", "assessment", "practice", "codebench", "learning"] as const
export type LiveEventFilter = (typeof LIVE_EVENT_FILTERS)[number]

export type MetricDefinition = {
  id: string
  label: string
  definition: string
  source: string
  calculation: string
  minSample: number
  window: string
}

export const METRIC_DEFINITIONS: Record<string, MetricDefinition> = {
  cora_sessions: {
    id: "cora_sessions",
    label: "Cora Sessions",
    definition: "Student Cora interactions in the selected window (usage events, assessment Ask Cora, and tutor turns).",
    source: "cora_usage_events, cora_assessment_events, ai_tutor_conversations, cora_interaction_events",
    calculation: "Count of student interaction events after course/section filters. Equivalent prior window used for % change.",
    minSample: 1,
    window: "Selected date range",
  },
  active_students: {
    id: "active_students",
    label: "Active Students",
    definition: "Roster students with at least one Cora interaction in the window.",
    source: "Same interaction sources joined to the course roster",
    calculation: "COUNT(DISTINCT student_id) among in-scope events",
    minSample: 1,
    window: "Selected date range",
  },
  students_needing_attention: {
    id: "students_needing_attention",
    label: "Students Needing Attention",
    definition: "Students whose combined academic, engagement, and assistance signals exceed the attention threshold.",
    source: "Quiz/practice outcomes + Cora events + missed work + trend",
    calculation: "Multi-signal score. Cora usage alone never flags a student.",
    minSample: 3,
    window: "Selected date range vs prior equivalent window",
  },
  avg_requests: {
    id: "avg_requests",
    label: "Avg. Cora Requests / Student",
    definition: "Mean Cora interactions among students who used Cora.",
    source: "Interaction events",
    calculation: "sessions / active students (active > 0)",
    minSample: 3,
    window: "Selected date range",
  },
  assisted_success: {
    id: "assisted_success",
    label: "Cora-Assisted Success Rate",
    definition: "Share of known subsequent attempts that were correct after Cora guidance.",
    source: "ai_learning_interactions.next_attempt_correct, cora_assessment_events.subsequent_correct",
    calculation: "correct_after / known_after. Hidden when known_after < min sample.",
    minSample: 8,
    window: "Selected date range",
  },
  answers_blocked: {
    id: "answers_blocked",
    label: "Answer-Seeking Requests Blocked",
    definition: "Ask Cora requests classified as answer-seeking or blocked by assessment integrity policy. Not a misconduct finding.",
    source: "cora_assessment_events",
    calculation: "COUNT where answer_blocked OR was_answer_seeking",
    minSample: 1,
    window: "Selected date range",
  },
  learning_health: {
    id: "learning_health",
    label: "Class Learning Health",
    definition: "Roster distribution by performance band. Low engagement is not treated as academic failure.",
    source: "Quiz + practice accuracy in window; inactivity uses a separate engagement axis",
    calculation: "Strong ≥80%, Developing 60–79%, Struggling 40–59%, Critical <40% among students with ≥3 scored items. Others excluded from the bar.",
    minSample: 5,
    window: "Selected date range",
  },
  concept_difficulty: {
    id: "concept_difficulty",
    label: "Concept Difficulty",
    definition: "Students affected by a concept via Cora requests and/or incorrect attempts.",
    source: "Stored topic/concept fields + assessment/practice outcomes",
    calculation: "Distinct students with concept-tagged help or incorrect attempts",
    minSample: 3,
    window: "Selected date range",
  },
  independence: {
    id: "independence",
    label: "Assistance Need Trend",
    definition: "Whether a student needs less Cora help over time while maintaining performance.",
    source: "Requests per task, hint depth, independent success, week-over-week trend",
    calculation: "Neutral labels only. Requires ≥2 weeks and ≥6 interactions.",
    minSample: 6,
    window: "Week buckets in range",
  },
  support_need: {
    id: "support_need",
    label: "Support Need",
    definition: "Likelihood the student would benefit from instructor follow-up. Not a grade prediction.",
    source: "Measurable features listed in the evidence list",
    calculation: "Weighted feature score with explicit evidence. Shown only when confidence ≥60% and ≥4 features.",
    minSample: 4,
    window: "Selected date range",
  },
}

export function metricDef(id: string): MetricDefinition {
  return (
    METRIC_DEFINITIONS[id] ?? {
      id,
      label: id,
      definition: "See Cora Insights metric catalog.",
      source: "Structured Cora analytics",
      calculation: "Aggregated from scoped events",
      minSample: 1,
      window: "Selected date range",
    }
  )
}
