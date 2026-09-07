/**
 * Course-level assessment defaults (course_policies.assessment_policy JSONB).
 * Individual assessments inherit these when their own field is unset.
 */

import {
  CIRCUIT_SECTION_SECONDS_PER_QUESTION,
  HYBRID_CIRCUIT_SECTION_POOLED_SECONDS,
  OBJECTIVE_QUESTION_TIMER_SECONDS,
} from "@/lib/assessment-timer"
import {
  DEFAULT_OPUS_CONFIDENCE_THRESHOLD,
  type AiGradingTask,
  type AiModelPreset,
  parseAiModelByTask,
  parseAiModelPreset,
} from "@/lib/ai-model-catalog"
import { getDefaultTimeLimit } from "@/lib/config/quizSettings"
import type { SectionConfig, SectionTimerMode } from "@/lib/assessment-sections"

export type AiEvaluationModeDefault = "relaxed" | "standard" | "strict" | "very_strict"
export type RetakePolicyDefault = "best" | "latest" | "average"

/** Timer defaults for hybrid / sectioned assessments. */
export type AssessmentTimerPolicy = {
  /** Fallback when a question has no time_limit and quiz.time_per_question is unset. */
  time_per_question_default: number
  objective_mcq_seconds: number
  objective_true_false_seconds: number
  objective_select_all_seconds: number
  /** Section II pooled time when paired with an objective Section I. */
  hybrid_circuit_section_pooled_seconds: number
  /** Pooled time = question_count × this for circuit-only / single-section exams. */
  circuit_only_seconds_per_question: number
}

/** Default section behavior when timer_mode is not set on a section row. */
export type AssessmentSectionPolicy = {
  objective_timer_mode: SectionTimerMode
  objective_allow_backtracking: boolean
  objective_auto_submit_on_expire: boolean
  circuit_timer_mode: SectionTimerMode
  circuit_allow_backtracking: boolean
  circuit_auto_submit_on_expire: boolean
}

export type AssessmentRetakePolicy = {
  retake_enabled_default: boolean
  retake_limit_default: number
  retake_policy_default: RetakePolicyDefault
  review_before_retake_default: boolean
  forfeit_retake_on_report_view_default: boolean
  lock_student_results_review_default: boolean
}

export type AssessmentAntiCheatPolicy = {
  strict_mode_default: boolean
  block_copy_paste_default: boolean
  track_tab_switches_default: boolean
  max_tab_switches_default: number
  warn_on_tab_switch_default: boolean
  auto_submit_on_violations_default: boolean
  require_fullscreen_default: boolean
  track_gemini_window_default: boolean
  max_gemini_strikes_default: number
  keystroke_playback_enforced_default: boolean
}

export type AssessmentAiPolicy = {
  ai_evaluation_mode_default: AiEvaluationModeDefault
  /** Course-wide AI model preset (`auto` = task-based routing). */
  ai_model_default: AiModelPreset
  /** Per-task overrides, e.g. { code: "claude-sonnet-5" }. */
  ai_model_by_task_default: Partial<Record<AiGradingTask, AiModelPreset>> | null
  /** Escalate to Opus when grading confidence is below threshold. */
  ai_enable_opus_fallback_default: boolean
  ai_opus_confidence_threshold_default: number
}

export type AssessmentAccessPolicy = {
  counts_toward_grade_default: boolean
  restrict_access_default: boolean
  geo_required_default: boolean
  geo_radius_meters_default: number
}

export type AssessmentSuperpowerPolicy = {
  enable_superpowers_default: boolean
}

export type AssessmentPolicy = {
  timer: AssessmentTimerPolicy
  sections: AssessmentSectionPolicy
  retakes: AssessmentRetakePolicy
  anti_cheat: AssessmentAntiCheatPolicy
  ai: AssessmentAiPolicy
  access: AssessmentAccessPolicy
  superpowers: AssessmentSuperpowerPolicy
}

export const DEFAULT_ASSESSMENT_TIMER_POLICY: AssessmentTimerPolicy = {
  time_per_question_default: 30,
  objective_mcq_seconds: OBJECTIVE_QUESTION_TIMER_SECONDS.mcq,
  objective_true_false_seconds: OBJECTIVE_QUESTION_TIMER_SECONDS.true_false,
  objective_select_all_seconds: OBJECTIVE_QUESTION_TIMER_SECONDS.select_all,
  hybrid_circuit_section_pooled_seconds: HYBRID_CIRCUIT_SECTION_POOLED_SECONDS,
  circuit_only_seconds_per_question: CIRCUIT_SECTION_SECONDS_PER_QUESTION,
}

export const DEFAULT_ASSESSMENT_SECTION_POLICY: AssessmentSectionPolicy = {
  objective_timer_mode: "per_question",
  objective_allow_backtracking: false,
  objective_auto_submit_on_expire: true,
  circuit_timer_mode: "section_timer",
  circuit_allow_backtracking: true,
  circuit_auto_submit_on_expire: true,
}

export const DEFAULT_ASSESSMENT_RETAKE_POLICY: AssessmentRetakePolicy = {
  retake_enabled_default: false,
  retake_limit_default: 0,
  retake_policy_default: "best",
  review_before_retake_default: false,
  forfeit_retake_on_report_view_default: false,
  lock_student_results_review_default: false,
}

export const DEFAULT_ASSESSMENT_ANTI_CHEAT_POLICY: AssessmentAntiCheatPolicy = {
  strict_mode_default: false,
  block_copy_paste_default: true,
  track_tab_switches_default: true,
  max_tab_switches_default: 3,
  warn_on_tab_switch_default: true,
  auto_submit_on_violations_default: true,
  require_fullscreen_default: false,
  track_gemini_window_default: true,
  max_gemini_strikes_default: 0,
  keystroke_playback_enforced_default: true,
}

export const DEFAULT_ASSESSMENT_AI_POLICY: AssessmentAiPolicy = {
  ai_evaluation_mode_default: "standard",
  ai_model_default: "auto",
  ai_model_by_task_default: null,
  ai_enable_opus_fallback_default: false,
  ai_opus_confidence_threshold_default: DEFAULT_OPUS_CONFIDENCE_THRESHOLD,
}

export const DEFAULT_ASSESSMENT_ACCESS_POLICY: AssessmentAccessPolicy = {
  counts_toward_grade_default: true,
  restrict_access_default: false,
  geo_required_default: false,
  geo_radius_meters_default: 100,
}

export const DEFAULT_ASSESSMENT_SUPERPOWER_POLICY: AssessmentSuperpowerPolicy = {
  enable_superpowers_default: false,
}

export const DEFAULT_ASSESSMENT_POLICY: AssessmentPolicy = {
  timer: DEFAULT_ASSESSMENT_TIMER_POLICY,
  sections: DEFAULT_ASSESSMENT_SECTION_POLICY,
  retakes: DEFAULT_ASSESSMENT_RETAKE_POLICY,
  anti_cheat: DEFAULT_ASSESSMENT_ANTI_CHEAT_POLICY,
  ai: DEFAULT_ASSESSMENT_AI_POLICY,
  access: DEFAULT_ASSESSMENT_ACCESS_POLICY,
  superpowers: DEFAULT_ASSESSMENT_SUPERPOWER_POLICY,
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

function parseBool(v: unknown, fallback: boolean): boolean {
  if (typeof v === "boolean") return v
  return fallback
}

function parseNum(v: unknown, fallback: number, min = 0, max = 100000): number {
  const n = Number(v)
  if (!Number.isFinite(n)) return fallback
  return clamp(n, min, max)
}

function parseTimerMode(v: unknown, fallback: SectionTimerMode): SectionTimerMode {
  if (v === "per_question" || v === "section_timer") return v
  return fallback
}

function parseRetakePolicy(v: unknown, fallback: RetakePolicyDefault): RetakePolicyDefault {
  if (v === "best" || v === "latest" || v === "average") return v
  return fallback
}

function parseAiMode(v: unknown, fallback: AiEvaluationModeDefault): AiEvaluationModeDefault {
  if (v === "relaxed" || v === "standard" || v === "strict" || v === "very_strict") return v
  return fallback
}

function parseSection(raw: unknown): AssessmentSectionPolicy {
  const d = DEFAULT_ASSESSMENT_SECTION_POLICY
  if (!raw || typeof raw !== "object") return { ...d }
  const o = raw as Record<string, unknown>
  return {
    objective_timer_mode: parseTimerMode(o.objective_timer_mode, d.objective_timer_mode),
    objective_allow_backtracking: parseBool(o.objective_allow_backtracking, d.objective_allow_backtracking),
    objective_auto_submit_on_expire: parseBool(o.objective_auto_submit_on_expire, d.objective_auto_submit_on_expire),
    circuit_timer_mode: parseTimerMode(o.circuit_timer_mode, d.circuit_timer_mode),
    circuit_allow_backtracking: parseBool(o.circuit_allow_backtracking, d.circuit_allow_backtracking),
    circuit_auto_submit_on_expire: parseBool(o.circuit_auto_submit_on_expire, d.circuit_auto_submit_on_expire),
  }
}

function parseTimer(raw: unknown): AssessmentTimerPolicy {
  const d = DEFAULT_ASSESSMENT_TIMER_POLICY
  if (!raw || typeof raw !== "object") return { ...d }
  const o = raw as Record<string, unknown>
  return {
    time_per_question_default: parseNum(o.time_per_question_default, d.time_per_question_default, 10, 7200),
    objective_mcq_seconds: parseNum(o.objective_mcq_seconds, d.objective_mcq_seconds, 10, 3600),
    objective_true_false_seconds: parseNum(o.objective_true_false_seconds, d.objective_true_false_seconds, 10, 3600),
    objective_select_all_seconds: parseNum(o.objective_select_all_seconds, d.objective_select_all_seconds, 10, 3600),
    hybrid_circuit_section_pooled_seconds: parseNum(
      o.hybrid_circuit_section_pooled_seconds,
      d.hybrid_circuit_section_pooled_seconds,
      60,
      86400,
    ),
    circuit_only_seconds_per_question: parseNum(
      o.circuit_only_seconds_per_question,
      d.circuit_only_seconds_per_question,
      60,
      7200,
    ),
  }
}

function parseRetakes(raw: unknown): AssessmentRetakePolicy {
  const d = DEFAULT_ASSESSMENT_RETAKE_POLICY
  if (!raw || typeof raw !== "object") return { ...d }
  const o = raw as Record<string, unknown>
  return {
    retake_enabled_default: parseBool(o.retake_enabled_default, d.retake_enabled_default),
    retake_limit_default: parseNum(o.retake_limit_default, d.retake_limit_default, 0, 20),
    retake_policy_default: parseRetakePolicy(o.retake_policy_default, d.retake_policy_default),
    review_before_retake_default: parseBool(o.review_before_retake_default, d.review_before_retake_default),
    forfeit_retake_on_report_view_default: parseBool(
      o.forfeit_retake_on_report_view_default,
      d.forfeit_retake_on_report_view_default,
    ),
    lock_student_results_review_default: parseBool(
      o.lock_student_results_review_default,
      d.lock_student_results_review_default,
    ),
  }
}

function parseAntiCheat(raw: unknown): AssessmentAntiCheatPolicy {
  const d = DEFAULT_ASSESSMENT_ANTI_CHEAT_POLICY
  if (!raw || typeof raw !== "object") return { ...d }
  const o = raw as Record<string, unknown>
  return {
    strict_mode_default: parseBool(o.strict_mode_default, d.strict_mode_default),
    block_copy_paste_default: parseBool(o.block_copy_paste_default, d.block_copy_paste_default),
    track_tab_switches_default: parseBool(o.track_tab_switches_default, d.track_tab_switches_default),
    max_tab_switches_default: parseNum(o.max_tab_switches_default, d.max_tab_switches_default, 0, 50),
    warn_on_tab_switch_default: parseBool(o.warn_on_tab_switch_default, d.warn_on_tab_switch_default),
    auto_submit_on_violations_default: parseBool(
      o.auto_submit_on_violations_default,
      d.auto_submit_on_violations_default,
    ),
    require_fullscreen_default: parseBool(o.require_fullscreen_default, d.require_fullscreen_default),
    track_gemini_window_default: parseBool(o.track_gemini_window_default, d.track_gemini_window_default),
    max_gemini_strikes_default: parseNum(o.max_gemini_strikes_default, d.max_gemini_strikes_default, 0, 20),
    keystroke_playback_enforced_default: parseBool(
      o.keystroke_playback_enforced_default,
      d.keystroke_playback_enforced_default,
    ),
  }
}

function parseAi(raw: unknown): AssessmentAiPolicy {
  const d = DEFAULT_ASSESSMENT_AI_POLICY
  if (!raw || typeof raw !== "object") return { ...d }
  const o = raw as Record<string, unknown>
  const thresholdRaw = Number(o.ai_opus_confidence_threshold_default)
  return {
    ai_evaluation_mode_default: parseAiMode(o.ai_evaluation_mode_default, d.ai_evaluation_mode_default),
    ai_model_default: parseAiModelPreset(o.ai_model_default, d.ai_model_default),
    ai_model_by_task_default: parseAiModelByTask(o.ai_model_by_task_default),
    ai_enable_opus_fallback_default:
      typeof o.ai_enable_opus_fallback_default === "boolean"
        ? o.ai_enable_opus_fallback_default
        : d.ai_enable_opus_fallback_default,
    ai_opus_confidence_threshold_default:
      Number.isFinite(thresholdRaw) && thresholdRaw > 0 && thresholdRaw < 1
        ? thresholdRaw
        : d.ai_opus_confidence_threshold_default,
  }
}

function parseAccess(raw: unknown): AssessmentAccessPolicy {
  const d = DEFAULT_ASSESSMENT_ACCESS_POLICY
  if (!raw || typeof raw !== "object") return { ...d }
  const o = raw as Record<string, unknown>
  return {
    counts_toward_grade_default: parseBool(o.counts_toward_grade_default, d.counts_toward_grade_default),
    restrict_access_default: parseBool(o.restrict_access_default, d.restrict_access_default),
    geo_required_default: parseBool(o.geo_required_default, d.geo_required_default),
    geo_radius_meters_default: parseNum(o.geo_radius_meters_default, d.geo_radius_meters_default, 10, 5000),
  }
}

function parseSuperpowers(raw: unknown): AssessmentSuperpowerPolicy {
  const d = DEFAULT_ASSESSMENT_SUPERPOWER_POLICY
  if (!raw || typeof raw !== "object") return { ...d }
  const o = raw as Record<string, unknown>
  return {
    enable_superpowers_default: parseBool(o.enable_superpowers_default, d.enable_superpowers_default),
  }
}

export function parseAssessmentPolicy(raw: unknown): AssessmentPolicy {
  if (!raw || typeof raw !== "object") return structuredClone(DEFAULT_ASSESSMENT_POLICY)
  const o = raw as Record<string, unknown>
  return {
    timer: parseTimer(o.timer),
    sections: parseSection(o.sections),
    retakes: parseRetakes(o.retakes),
    anti_cheat: parseAntiCheat(o.anti_cheat),
    ai: parseAi(o.ai),
    access: parseAccess(o.access),
    superpowers: parseSuperpowers(o.superpowers),
  }
}

export function mergeAssessmentPolicy(existing: unknown, patch: unknown): AssessmentPolicy {
  const base = parseAssessmentPolicy(existing)
  if (!patch || typeof patch !== "object") return base
  const p = patch as Record<string, unknown>
  return parseAssessmentPolicy({
    timer: { ...base.timer, ...(typeof p.timer === "object" && p.timer ? p.timer : {}) },
    sections: { ...base.sections, ...(typeof p.sections === "object" && p.sections ? p.sections : {}) },
    retakes: { ...base.retakes, ...(typeof p.retakes === "object" && p.retakes ? p.retakes : {}) },
    anti_cheat: { ...base.anti_cheat, ...(typeof p.anti_cheat === "object" && p.anti_cheat ? p.anti_cheat : {}) },
    ai: { ...base.ai, ...(typeof p.ai === "object" && p.ai ? p.ai : {}) },
    access: { ...base.access, ...(typeof p.access === "object" && p.access ? p.access : {}) },
    superpowers: {
      ...base.superpowers,
      ...(typeof p.superpowers === "object" && p.superpowers ? p.superpowers : {}),
    },
  })
}

/** Objective per-type seconds from course policy. */
export function objectiveTimerSecondsFromPolicy(
  questionType: string,
  policy?: AssessmentPolicy | null,
): number | null {
  const p = policy?.timer ?? DEFAULT_ASSESSMENT_TIMER_POLICY
  const qt = (questionType || "mcq").toLowerCase()
  if (qt === "mcq" || qt === "multiple_choice") return p.objective_mcq_seconds
  if (qt === "true_false") return p.objective_true_false_seconds
  if (qt === "select_all" || qt === "multi_output") return p.objective_select_all_seconds
  return null
}

const FLEX_TYPES = new Set(["circuit_submission", "multi_part"])

export function isFlexibleSectionTypes(types: string[]): boolean {
  return types.some((t) => FLEX_TYPES.has(t.toLowerCase()))
}

/** Apply course section timer defaults to a section missing explicit timer fields. */
export function applySectionDefaultsFromPolicy(
  section: SectionConfig,
  policy?: AssessmentPolicy | null,
): SectionConfig {
  const sp = policy?.sections ?? DEFAULT_ASSESSMENT_SECTION_POLICY
  const tp = policy?.timer ?? DEFAULT_ASSESSMENT_TIMER_POLICY
  const isFlex = isFlexibleSectionTypes(section.question_types || [])

  if (isFlex) {
    return {
      ...section,
      timer_mode: section.timer_mode ?? sp.circuit_timer_mode,
      allow_backtracking: section.allow_backtracking ?? sp.circuit_allow_backtracking,
      auto_submit_on_expire: section.auto_submit_on_expire ?? sp.circuit_auto_submit_on_expire,
      total_time_seconds: section.total_time_seconds ?? tp.hybrid_circuit_section_pooled_seconds,
    }
  }

  return {
    ...section,
    timer_mode: section.timer_mode ?? sp.objective_timer_mode,
    allow_backtracking: section.allow_backtracking ?? sp.objective_allow_backtracking,
    auto_submit_on_expire: section.auto_submit_on_expire ?? sp.objective_auto_submit_on_expire,
    timers: {
      ...section.timers,
      mcq: tp.objective_mcq_seconds,
      true_false: tp.objective_true_false_seconds,
      select_all: tp.objective_select_all_seconds,
    },
  }
}

export function applySectionConfigDefaultsFromPolicy(
  sections: SectionConfig[] | null | undefined,
  policy?: AssessmentPolicy | null,
): SectionConfig[] | null {
  if (!sections?.length) return sections ?? null
  return sections.map((s) => applySectionDefaultsFromPolicy(s, policy))
}

/** Per-type platform default from quizSettings when no course override applies. */
export function defaultTimeLimitForType(questionType: string): number {
  return getDefaultTimeLimit(questionType)
}
