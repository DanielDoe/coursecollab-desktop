/**
 * Resolve effective assessment settings: course defaults → quiz overrides.
 */

import type { SectionConfig } from "@/lib/assessment-sections"
import { buildQuizAntiCheatConfigFromDb } from "@/lib/antiCheatConfig"
import {
  applySectionConfigDefaultsFromPolicy,
  parseAssessmentPolicy,
  type AssessmentPolicy,
  type AssessmentTimerPolicy,
} from "@/lib/assessment-policy-settings"
import { getAssessmentPolicyForCourse } from "@/lib/assessment-policy-settings.server"

export type QuizSettingsRow = {
  course_id?: number | null
  assessment_type?: string | null
  title?: string | null
  time_per_question?: number | null
  retake_enabled?: boolean | null
  retake_limit?: number | null
  retake_policy?: string | null
  review_before_retake?: boolean | null
  forfeit_retake_on_report_view?: boolean | null
  lock_student_results_review?: boolean | null
  strict_mode_enabled?: boolean | null
  block_copy_paste?: boolean | null
  track_tab_switches?: boolean | null
  max_tab_switches?: number | null
  warn_on_tab_switch?: boolean | null
  auto_submit_on_violations?: boolean | null
  require_fullscreen?: boolean | null
  track_gemini_window?: boolean | null
  max_gemini_strikes?: number | null
  keystroke_playback_enforced?: boolean | null
  ai_evaluation_mode?: string | null
  counts_toward_course_grade?: boolean | null
  restrict_access_to_students?: boolean | null
  geo_required?: boolean | null
  geo_radius_meters?: number | null
  enable_superpowers?: boolean | null
  section_config?: SectionConfig[] | unknown | null
  track_mouse_movement?: boolean | null
  available_until?: Date | string | null
}

export type ResolvedQuizSettings = {
  policy: AssessmentPolicy
  time_per_question: number
  retake_enabled: boolean
  retake_limit: number
  retake_policy: string
  review_before_retake: boolean
  forfeit_retake_on_report_view: boolean
  lock_student_results_review: boolean
  strict_mode_enabled: boolean
  block_copy_paste: boolean
  track_tab_switches: boolean
  max_tab_switches: number
  warn_on_tab_switch: boolean
  auto_submit_on_violations: boolean
  require_fullscreen: boolean
  track_gemini_window: boolean
  max_gemini_strikes: number
  keystroke_playback_enforced: boolean
  ai_evaluation_mode: string
  counts_toward_course_grade: boolean
  restrict_access_to_students: boolean
  geo_required: boolean
  geo_radius_meters: number
  enable_superpowers: boolean
  section_config: SectionConfig[] | null
}

function pickBool(
  quizVal: boolean | null | undefined,
  defaultVal: boolean,
): boolean {
  return typeof quizVal === "boolean" ? quizVal : defaultVal
}

function pickNum(
  quizVal: number | null | undefined,
  defaultVal: number,
): number {
  const n = Number(quizVal)
  return Number.isFinite(n) ? n : defaultVal
}

function pickStr(
  quizVal: string | null | undefined,
  defaultVal: string,
): string {
  return quizVal != null && String(quizVal).trim() !== "" ? String(quizVal) : defaultVal
}

export function resolveQuizSettings(
  quiz: QuizSettingsRow,
  policy: AssessmentPolicy,
): ResolvedQuizSettings {
  const ac = policy.anti_cheat
  const rt = policy.retakes
  const ai = policy.ai
  const access = policy.access
  const sp = policy.superpowers
  const timer = policy.timer

  const rawSections = Array.isArray(quiz.section_config)
    ? (quiz.section_config as SectionConfig[])
    : null

  return {
    policy,
    time_per_question: pickNum(quiz.time_per_question, timer.time_per_question_default),
    retake_enabled: pickBool(quiz.retake_enabled, rt.retake_enabled_default),
    retake_limit: pickNum(quiz.retake_limit, rt.retake_limit_default),
    retake_policy: pickStr(quiz.retake_policy, rt.retake_policy_default),
    review_before_retake: pickBool(quiz.review_before_retake, rt.review_before_retake_default),
    forfeit_retake_on_report_view: pickBool(
      quiz.forfeit_retake_on_report_view,
      rt.forfeit_retake_on_report_view_default,
    ),
    lock_student_results_review: pickBool(
      quiz.lock_student_results_review,
      rt.lock_student_results_review_default,
    ),
    strict_mode_enabled: pickBool(quiz.strict_mode_enabled, ac.strict_mode_default),
    block_copy_paste: pickBool(quiz.block_copy_paste, ac.block_copy_paste_default),
    track_tab_switches: pickBool(quiz.track_tab_switches, ac.track_tab_switches_default),
    max_tab_switches: pickNum(quiz.max_tab_switches, ac.max_tab_switches_default),
    warn_on_tab_switch: pickBool(quiz.warn_on_tab_switch, ac.warn_on_tab_switch_default),
    auto_submit_on_violations: pickBool(
      quiz.auto_submit_on_violations,
      ac.auto_submit_on_violations_default,
    ),
    require_fullscreen: pickBool(quiz.require_fullscreen, ac.require_fullscreen_default),
    track_gemini_window: pickBool(quiz.track_gemini_window, ac.track_gemini_window_default),
    max_gemini_strikes: pickNum(quiz.max_gemini_strikes, ac.max_gemini_strikes_default),
    keystroke_playback_enforced: pickBool(
      quiz.keystroke_playback_enforced,
      ac.keystroke_playback_enforced_default,
    ),
    ai_evaluation_mode: pickStr(quiz.ai_evaluation_mode, ai.ai_evaluation_mode_default),
    counts_toward_course_grade: pickBool(
      quiz.counts_toward_course_grade,
      access.counts_toward_grade_default,
    ),
    restrict_access_to_students: pickBool(
      quiz.restrict_access_to_students,
      access.restrict_access_default,
    ),
    geo_required: pickBool(quiz.geo_required, access.geo_required_default),
    geo_radius_meters: pickNum(quiz.geo_radius_meters, access.geo_radius_meters_default),
    enable_superpowers: pickBool(quiz.enable_superpowers, sp.enable_superpowers_default),
    section_config: applySectionConfigDefaultsFromPolicy(rawSections, policy),
  }
}

export async function resolveQuizSettingsForCourse(
  quiz: QuizSettingsRow,
): Promise<ResolvedQuizSettings> {
  const policy = await getAssessmentPolicyForCourse(quiz.course_id ?? null)
  return resolveQuizSettings(quiz, policy)
}

/** Client-side: quiz row + policy JSON from API. */
export function resolveQuizSettingsWithPolicy(
  quiz: QuizSettingsRow,
  policyRaw: unknown,
): ResolvedQuizSettings {
  return resolveQuizSettings(quiz, parseAssessmentPolicy(policyRaw))
}

/** Row for buildQuizAntiCheatConfigFromDb after merging course defaults. */
export function antiCheatDbRowFromResolved(
  resolved: ResolvedQuizSettings,
  quiz: QuizSettingsRow,
) {
  return {
    assessment_type: quiz.assessment_type ?? null,
    title: quiz.title ?? null,
    strict_mode_enabled: resolved.strict_mode_enabled,
    block_copy_paste: resolved.block_copy_paste,
    track_tab_switches: resolved.track_tab_switches,
    track_mouse_movement: quiz.track_mouse_movement ?? false,
    warn_on_tab_switch: resolved.warn_on_tab_switch,
    max_tab_switches: resolved.max_tab_switches,
    auto_submit_on_violations: resolved.auto_submit_on_violations,
    track_gemini_window: resolved.track_gemini_window,
    max_gemini_strikes: resolved.max_gemini_strikes,
    require_fullscreen: resolved.require_fullscreen,
    keystroke_playback_enforced: resolved.keystroke_playback_enforced,
  }
}

export type TakeQuizResponsePayload = {
  id: number
  title: string
  description?: string | null
  time_per_question: number
  retake_enabled: boolean
  retake_limit: number | null
  retake_policy: string
  section_config: SectionConfig[] | null
  course_timer: AssessmentTimerPolicy
  antiCheatConfig: ReturnType<typeof buildQuizAntiCheatConfigFromDb>
  track_gemini_window: boolean
  max_gemini_strikes: number
  extraTimePerQuestion?: number
  activeSuperpowers?: string[]
  available_until?: string | null
}

/** Build student take-route quiz object with course defaults applied. */
export function buildTakeQuizPayload(
  quiz: QuizSettingsRow & { id: number; title: string; description?: string | null },
  resolved: ResolvedQuizSettings,
  extras?: {
    extraTimePerQuestion?: number
    activeSuperpowers?: string[]
    antiCheatOverride?: ReturnType<typeof buildQuizAntiCheatConfigFromDb>
  },
): TakeQuizResponsePayload {
  const antiCheat =
    extras?.antiCheatOverride ??
    buildQuizAntiCheatConfigFromDb(antiCheatDbRowFromResolved(resolved, quiz))

  return {
    id: quiz.id,
    title: quiz.title,
    description: quiz.description ?? null,
    time_per_question: resolved.time_per_question,
    retake_enabled: resolved.retake_enabled,
    retake_limit: resolved.retake_limit,
    retake_policy: resolved.retake_policy,
    section_config: resolved.section_config,
    course_timer: resolved.policy.timer,
    antiCheatConfig: antiCheat,
    track_gemini_window: antiCheat.trackGeminiWindow ?? true,
    max_gemini_strikes: antiCheat.maxGeminiStrikes ?? 5,
    extraTimePerQuestion: extras?.extraTimePerQuestion,
    activeSuperpowers: extras?.activeSuperpowers,
    available_until:
      quiz.available_until != null ? String(quiz.available_until) : null,
  }
}
