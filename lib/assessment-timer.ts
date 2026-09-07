/**
 * Hybrid assessment timer: per-question (Section I objective) vs section-level (Section II circuit).
 */

import type { QuestionSection, SectionConfig } from "@/lib/assessment-sections"

/** Homework is practice-oriented — due dates apply, not per-question/section countdowns. */
export function isUntimedAssessmentType(assessmentType: string | null | undefined): boolean {
  const t = String(assessmentType ?? "")
    .trim()
    .toLowerCase()
    .replace(/-/g, "_")
  return t === "homework" || t === "homeworks"
}
import { getDefaultTimeLimit } from "@/lib/config/quizSettings"
import { isUntimedMultiPartQuestion } from "@/lib/multi-part-time-limit"
import { hasActiveQuestionMedia, resolveQuestionMedia } from "@/lib/question-media"

export type SectionTimerMode = "per_question" | "section_timer"

/** Default per-type limits for strict objective sections (seconds). */
export const OBJECTIVE_QUESTION_TIMER_SECONDS = {
  mcq: 30,
  true_false: 30,
  select_all: 35,
} as const

/** Extra seconds when an objective question shows a circuit diagram / figure. */
export const OBJECTIVE_DIAGRAM_EXTRA_SECONDS = 10

export type ObjectiveQuestionTimerKey = keyof typeof OBJECTIVE_QUESTION_TIMER_SECONDS

export type QuestionTimerMediaInput = {
  question_media?: unknown
  circuit_spec?: unknown
  bank_question_media?: unknown
}

export function questionHasCircuitDiagram(question: QuestionTimerMediaInput): boolean {
  return hasActiveQuestionMedia(resolveQuestionMedia(question))
}

function isObjectiveQuestionType(qt: string): boolean {
  return OBJECTIVE_TYPES.has(qt) || qt === "multiple_choice"
}

/** Base per-question limit for MCQ / T-F / select-all (no diagram bonus). */
export function resolveObjectiveBaseTimeSeconds(
  questionType: string,
  courseTimer?: {
    objective_mcq_seconds?: number
    objective_true_false_seconds?: number
    objective_select_all_seconds?: number
  } | null,
): number {
  const qt = normalizeType(questionType)
  if (qt === "mcq" || qt === "multiple_choice") {
    const n = courseTimer?.objective_mcq_seconds
    if (typeof n === "number" && n > 0) return n
    return OBJECTIVE_QUESTION_TIMER_SECONDS.mcq
  }
  if (qt === "true_false") {
    const n = courseTimer?.objective_true_false_seconds
    if (typeof n === "number" && n > 0) return n
    return OBJECTIVE_QUESTION_TIMER_SECONDS.true_false
  }
  if (qt === "select_all" || qt === "multi_output") {
    const n = courseTimer?.objective_select_all_seconds
    if (typeof n === "number" && n > 0) return n
    return OBJECTIVE_QUESTION_TIMER_SECONDS.select_all
  }
  return getDefaultTimeLimit(qt)
}

/** Stored time_limit for objective bank/quiz rows (base + 10s when a diagram is attached). */
export function resolveObjectiveQuestionTimeLimitSeconds(
  questionType: string,
  hasDiagram: boolean,
  courseTimer?: Parameters<typeof resolveObjectiveBaseTimeSeconds>[1],
): number {
  const base = resolveObjectiveBaseTimeSeconds(questionType, courseTimer)
  return base + (hasDiagram ? OBJECTIVE_DIAGRAM_EXTRA_SECONDS : 0)
}

/** Key in section timer maps for exam-wide pooled countdown (see exam_shared_timer_seconds). */
export const EXAM_SHARED_TIMER_SECTION_KEY = -1

export function getExamSharedTimerSeconds(
  parsedConfig: SectionConfig[] | null | undefined,
): number | null {
  if (!parsedConfig?.length) return null
  const n = Number(parsedConfig[0]?.exam_shared_timer_seconds)
  return Number.isFinite(n) && n > 0 ? n : null
}

export function usesExamSharedTimer(parsedConfig: SectionConfig[] | null | undefined): boolean {
  return getExamSharedTimerSeconds(parsedConfig) != null
}

/** Mirror exam-wide pool into each timed section index for UI / persistence. */
export function syncExamSharedSectionTimers(
  sectionTimers: Record<number, number>,
  parsedConfig: SectionConfig[] | null | undefined,
  seconds: number,
): void {
  sectionTimers[EXAM_SHARED_TIMER_SECTION_KEY] = seconds
  parsedConfig?.forEach((cfg, idx) => {
    if (usesSectionCountdown(cfg)) sectionTimers[idx] = seconds
  })
}

export function readExamSharedSectionSeconds(
  sectionTimers: Record<number, number>,
  parsedConfig: SectionConfig[] | null | undefined,
): number | undefined {
  const shared = getExamSharedTimerSeconds(parsedConfig)
  if (shared == null) return undefined
  const fromKey = sectionTimers[EXAM_SHARED_TIMER_SECTION_KEY]
  if (fromKey !== undefined) return fromKey
  for (let idx = 0; parsedConfig && idx < parsedConfig.length; idx++) {
    if (usesSectionCountdown(parsedConfig[idx]) && sectionTimers[idx] !== undefined) {
      return sectionTimers[idx]
    }
  }
  return undefined
}


/** Default section-level countdown when no explicit total is set (60 minutes). */
export const DEFAULT_SECTION_TIMER_SECONDS = 3600

/** Default exam-wide pooled timer for finals (90 minutes). */
export const DEFAULT_EXAM_SHARED_TIMER_SECONDS = 5400

export type AssessmentTimerStrategy = "mixed" | "exam_shared"

export function getAssessmentTimerStrategy(
  sections: SectionConfig[] | null | undefined,
): AssessmentTimerStrategy {
  return usesExamSharedTimer(sections) ? "exam_shared" : "mixed"
}

/** One pooled countdown for the entire assessment (stored on section 0). */
export function applyExamSharedTimerConfig(
  sections: SectionConfig[],
  totalSeconds: number,
): SectionConfig[] {
  const seconds = Math.max(
    60,
    Math.floor(Number(totalSeconds) || DEFAULT_EXAM_SHARED_TIMER_SECONDS),
  )
  return sections.map((section, index) => ({
    ...section,
    timer_mode: "section_timer" as const,
    total_time_seconds: seconds,
    allow_backtracking: section.allow_backtracking ?? true,
    auto_submit_on_expire: true,
    timers: undefined,
    exam_shared_timer_seconds: index === 0 ? seconds : undefined,
  }))
}

export function clearExamSharedTimerConfig(sections: SectionConfig[]): SectionConfig[] {
  return sections.map(({ exam_shared_timer_seconds: _removed, ...section }) => section)
}

/** Hybrid Section II pooled time when paired with a strict objective Section I. */
export const HYBRID_CIRCUIT_SECTION_POOLED_SECONDS = DEFAULT_SECTION_TIMER_SECONDS

/** Circuit-only section pool (same 60-minute budget as hybrid Section II). */
export const CIRCUIT_SECTION_SECONDS_PER_QUESTION = DEFAULT_SECTION_TIMER_SECONDS

const SECTION_TIMER_TYPES = new Set(["circuit_submission", "multi_part"])
const OBJECTIVE_TYPES = new Set(["mcq", "true_false", "select_all", "multiple_choice"])

function normalizeType(type: string): string {
  return (type || "mcq").toLowerCase().trim()
}

/** Infer timer mode when not explicitly set (legacy assessments keep prior behavior). */
export function resolveSectionTimerMode(section: SectionConfig | null | undefined): SectionTimerMode | null {
  if (!section) return null
  if (section.timer_mode === "per_question" || section.timer_mode === "section_timer") {
    return section.timer_mode
  }
  const types = (section.question_types || []).map(normalizeType)
  if (types.some((t) => SECTION_TIMER_TYPES.has(t))) return "section_timer"
  if (types.some((t) => OBJECTIVE_TYPES.has(t))) return "per_question"
  return null
}

export function isPerQuestionTimerSection(section: SectionConfig | null | undefined): boolean {
  return resolveSectionTimerMode(section) === "per_question"
}

export function isSectionTimerSection(section: SectionConfig | null | undefined): boolean {
  return resolveSectionTimerMode(section) === "section_timer"
}

export function sectionAllowsBacktracking(section: SectionConfig | null | undefined): boolean {
  if (!section) return true
  if (typeof section.allow_backtracking === "boolean") return section.allow_backtracking
  if (isPerQuestionTimerSection(section)) return false
  if (isSectionTimerSection(section)) return true
  return true
}

export function sectionAutoSubmitOnExpire(section: SectionConfig | null | undefined): boolean {
  if (!section) return true
  if (typeof section.auto_submit_on_expire === "boolean") return section.auto_submit_on_expire
  return true
}

/** Per-question limit for a question inside a configured section. */
export function resolveQuestionTimeLimitSeconds(
  questionType: string,
  questionTimeLimit: number | null | undefined,
  quizDefaultSeconds: number | null | undefined,
  section: SectionConfig | null | undefined,
  courseTimer?: {
    objective_mcq_seconds?: number
    objective_true_false_seconds?: number
    objective_select_all_seconds?: number
    time_per_question_default?: number
  } | null,
  options?: { hasDiagram?: boolean },
): number {
  const qt = normalizeType(questionType)
  const inSectionTimerSection = section && isSectionTimerSection(section)

  // Global objective policy: MCQ 30s, T/F 30s, select-all 35s (+10s when a diagram is shown).
  // Applies to all assessments — not only ECE2202 homework — except pooled section-timer blocks.
  if (isObjectiveQuestionType(qt) && !inSectionTimerSection) {
    let base = resolveObjectiveBaseTimeSeconds(qt, courseTimer)
    if (options?.hasDiagram) base += OBJECTIVE_DIAGRAM_EXTRA_SECONDS
    return base
  }

  if (section && isPerQuestionTimerSection(section)) {
    const fromSection = section.timers?.[qt as ObjectiveQuestionTimerKey]
    if (typeof fromSection === "number" && fromSection > 0) return fromSection
  }
  if (questionTimeLimit != null && questionTimeLimit > 0) return questionTimeLimit
  if (quizDefaultSeconds != null && quizDefaultSeconds > 0) return quizDefaultSeconds
  const courseDefault = courseTimer?.time_per_question_default
  if (typeof courseDefault === "number" && courseDefault > 0) return courseDefault
  return getDefaultTimeLimit(qt)
}

export function resolveSectionTotalTimeSeconds(
  section: SectionConfig | null | undefined,
  context?: {
    questionCountInSection?: number
    allSections?: SectionConfig[] | null
    courseTimer?: {
      hybrid_circuit_section_pooled_seconds?: number
      circuit_only_seconds_per_question?: number
    } | null
  },
): number {
  if (!section) return DEFAULT_SECTION_TIMER_SECONDS
  const examShared = getExamSharedTimerSeconds(context?.allSections)
  if (examShared != null && isSectionTimerSection(section)) return examShared

  const n = Number(section.total_time_seconds)
  if (Number.isFinite(n) && n > 0) return n

  if (isPerQuestionTimerSection(section)) return DEFAULT_SECTION_TIMER_SECONDS

  const ct = context?.courseTimer
  const hybridPool =
    typeof ct?.hybrid_circuit_section_pooled_seconds === "number" && ct.hybrid_circuit_section_pooled_seconds > 0
      ? ct.hybrid_circuit_section_pooled_seconds
      : HYBRID_CIRCUIT_SECTION_POOLED_SECONDS
  const circuitOnlyPool =
    typeof ct?.circuit_only_seconds_per_question === "number" && ct.circuit_only_seconds_per_question > 0
      ? ct.circuit_only_seconds_per_question
      : hybridPool

  const all = context?.allSections ?? null
  const qCount = Math.max(0, Number(context?.questionCountInSection) || 0)
  const hasObjectiveSibling = (all ?? []).some(
    (s) => s !== section && (isPerQuestionTimerSection(s) || sectionHasObjectiveTypes(s)),
  )
  const isOnlySection = !all || all.length <= 1
  const types = (section.question_types || []).map(normalizeType)
  const isCircuitLikeSection = types.some((t) => SECTION_TIMER_TYPES.has(t))

  if (isSectionTimerSection(section) && isCircuitLikeSection) {
    if (isOnlySection || !hasObjectiveSibling) return circuitOnlyPool
    return hybridPool
  }

  if ((isOnlySection || !hasObjectiveSibling) && qCount > 0 && !isCircuitLikeSection) {
    return hybridPool
  }

  return hybridPool
}

function sectionHasObjectiveTypes(section: SectionConfig): boolean {
  const types = (section.question_types || []).map(normalizeType)
  return types.some((t) => OBJECTIVE_TYPES.has(t))
}

/**
 * Whether this question uses an individual countdown (not section pool).
 * Legacy: no section timer_mode → multi_part untimed, others per-question unless untimed helper says otherwise.
 */
export function usesPerQuestionCountdown(
  questionType: string,
  section: SectionConfig | null | undefined,
  allSections?: SectionConfig[] | null,
  assessmentType?: string | null,
): boolean {
  if (isUntimedAssessmentType(assessmentType)) return false
  if (usesExamSharedTimer(allSections)) return false

  const qt = normalizeType(questionType)
  // Circuit / upload sections always use the pooled section timer — never a 30s MCQ countdown.
  if (SECTION_TIMER_TYPES.has(qt)) return false

  const mode = resolveSectionTimerMode(section)
  if (mode === "section_timer") return false
  if (mode === "per_question") return true
  return !isUntimedMultiPartQuestion(questionType)
}

/** Whether UI should show a section-level countdown for the current section. */
export function usesSectionCountdown(
  section: SectionConfig | null | undefined,
  assessmentType?: string | null,
): boolean {
  if (isUntimedAssessmentType(assessmentType)) return false
  return isSectionTimerSection(section)
}

/** Circuit / multi-part uploads may be replaced while section timer is active. */
export function allowsSubmissionReplacement(
  questionType: string,
  section: SectionConfig | null | undefined,
): boolean {
  const qt = normalizeType(questionType)
  if (!isSectionTimerSection(section)) return false
  return SECTION_TIMER_TYPES.has(qt)
}

export function getSectionConfigForQuestionIndex(
  questionIndex: number,
  sections: QuestionSection[],
  parsedConfig: SectionConfig[] | null,
): SectionConfig | null {
  if (!parsedConfig?.length || !sections.length) return null
  const sec = sections.find((s) => questionIndex >= s.startIndex && questionIndex <= s.endIndex)
  if (!sec) return null
  return parsedConfig[sec.sectionIndex] ?? null
}

/** Whether navigation to targetIndex is allowed from currentIndex (respects allow_backtracking). */
export function canNavigateToQuestionIndex(
  targetIndex: number,
  currentIndex: number,
  sections: QuestionSection[],
  parsedConfig: SectionConfig[] | null,
): boolean {
  if (targetIndex >= currentIndex) return true
  for (let i = targetIndex; i < currentIndex; i++) {
    if (!sectionAllowsBacktracking(getSectionConfigForQuestionIndex(i, sections, parsedConfig))) {
      return false
    }
  }
  return true
}

export function getSectionIndexForQuestion(
  questionIndex: number,
  sections: QuestionSection[],
): number | null {
  const sec = sections.find((s) => questionIndex >= s.startIndex && questionIndex <= s.endIndex)
  return sec?.sectionIndex ?? null
}

export function formatTimerMmSs(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(Number(totalSeconds) || 0))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${String(r).padStart(2, "0")}`
}

/** ECE2202-style presets for seeds and backfill. */
export const PRESET_OBJECTIVE_SECTION_TIMERS: SectionConfig["timers"] = {
  mcq: OBJECTIVE_QUESTION_TIMER_SECONDS.mcq,
  true_false: OBJECTIVE_QUESTION_TIMER_SECONDS.true_false,
  select_all: OBJECTIVE_QUESTION_TIMER_SECONDS.select_all,
}

export function withObjectiveSectionTimers(section: SectionConfig): SectionConfig {
  return {
    ...section,
    timer_mode: "per_question",
    allow_backtracking: false,
    auto_submit_on_expire: true,
    timers: { ...section.timers, ...PRESET_OBJECTIVE_SECTION_TIMERS },
  }
}

export function withCircuitSectionTimer(
  section: SectionConfig,
  options?: {
    totalSeconds?: number
    questionCountInSection?: number
    allSections?: SectionConfig[]
  },
): SectionConfig {
  const totalSeconds =
    options?.totalSeconds ??
    resolveSectionTotalTimeSeconds(section, {
      questionCountInSection: options?.questionCountInSection,
      allSections: options?.allSections,
    })
  return {
    ...section,
    timer_mode: "section_timer",
    total_time_seconds: totalSeconds,
    allow_backtracking: true,
    auto_submit_on_expire: true,
  }
}
