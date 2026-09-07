/**
 * Anti-Cheat Configuration
 * 
 * Controls system-wide anti-cheat behavior for exams and assessments.
 * Exemptions can be added here for question types that require external tools
 * or resources (e.g., MATLAB plot uploads).
 */

import type { SectionConfig } from "@/lib/assessment-sections"
import { isQuestionOrderInExternalToolsPositionSection } from "@/lib/assessment-sections"
import { isBrowserAiEnforcementPlatform } from "@/lib/device-utils"

export interface AntiCheatConfig {
  enabled: boolean
  tabSwitchLimit: number
  warnThreshold: number
  exemptQuestionTypes: string[]
  requireFullscreen: boolean
  disableCopyPaste: boolean
  logActivity: boolean
  trackGeminiWindow: boolean
  maxGeminiStrikes: number
}

export const antiCheatConfig: AntiCheatConfig = {
  enabled: true,
  tabSwitchLimit: 5, // Flag after 5 tab switches
  warnThreshold: 2, // Warn after 2 tab switches
  exemptQuestionTypes: ["code_write_plot", "circuit_upload_work", "circuit_submission"],
  requireFullscreen: true, // Require fullscreen for graded questions
  disableCopyPaste: true, // Disable copy/paste during exam
  logActivity: true, // Log user activity and suspicious behavior
  trackGeminiWindow: true, // Track Gemini window detection
  maxGeminiStrikes: 5, // Maximum strikes before auto-submit (configurable)
}

/**
 * Check if a question type is exempt from anti-cheat
 */
export function isQuestionTypeExempt(questionType: string): boolean {
  return antiCheatConfig.exemptQuestionTypes.includes(questionType)
}

export type AntiCheatQuestionContext = {
  /** 1-based question order (matches position bands in section_config). */
  questionOrder1Based?: number
  sectionConfig?: SectionConfig[] | null
}

/**
 * Check if anti-cheat should be active for a question
 * Takes into account both question type and database exemption flag
 */
export function shouldActivateAntiCheat(
  questionType: string,
  antiCheatExempt?: boolean,
  ctx?: AntiCheatQuestionContext,
): boolean {
  // If anti-cheat is globally disabled, return false
  if (!antiCheatConfig.enabled) {
    return false
  }

  // If question is explicitly exempt in database, return false
  if (antiCheatExempt === true) {
    return false
  }

  // If question type is in exempt list, return false
  if (isQuestionTypeExempt(questionType)) {
    return false
  }

  // Position-band sections that only allow MATLAB-style work (tabs, IDE, screenshots)
  if (
    ctx?.questionOrder1Based != null &&
    isQuestionOrderInExternalToolsPositionSection(ctx.questionOrder1Based, ctx.sectionConfig)
  ) {
    return false
  }

  // Otherwise, activate anti-cheat
  return true
}

/**
 * Get anti-cheat settings for a specific question
 */
export function getAntiCheatSettings(
  questionType: string,
  antiCheatExempt?: boolean,
  ctx?: AntiCheatQuestionContext,
) {
  const isActive = shouldActivateAntiCheat(questionType, antiCheatExempt, ctx)

  return {
    isActive,
    tabSwitchLimit: isActive ? antiCheatConfig.tabSwitchLimit : Infinity,
    warnThreshold: isActive ? antiCheatConfig.warnThreshold : Infinity,
    requireFullscreen: isActive && antiCheatConfig.requireFullscreen,
    disableCopyPaste: isActive && antiCheatConfig.disableCopyPaste,
    logActivity: isActive && antiCheatConfig.logActivity,
    trackGeminiWindow:
      isActive &&
      antiCheatConfig.trackGeminiWindow &&
      (typeof window === "undefined" || isBrowserAiEnforcementPlatform()),
    maxGeminiStrikes: isActive ? antiCheatConfig.maxGeminiStrikes : Infinity,
  }
}

export type QuizAntiCheatFlags = {
  strictModeEnabled?: boolean
  blockCopyPaste?: boolean
  trackTabSwitches?: boolean
  trackMouseMovement?: boolean
  trackGeminiWindow?: boolean
  requireFullscreen?: boolean
}

/** True when any quiz-level anti-cheat enforcement flag is explicitly enabled. */
export function isQuizLevelAntiCheatActive(
  config: QuizAntiCheatFlags | null | undefined,
): boolean {
  if (!config) return false
  return Boolean(
    config.strictModeEnabled ||
      config.blockCopyPaste ||
      config.trackTabSwitches ||
      config.trackMouseMovement ||
      config.trackGeminiWindow ||
      config.requireFullscreen,
  )
}

/** Resolve track_gemini_window from DB row — never infer true when strict mode is off. */
export function resolveTrackGeminiWindowFromDb(row: {
  track_gemini_window?: boolean | null
  strict_mode_enabled?: boolean | null
}): boolean {
  if (row.track_gemini_window != null) return Boolean(row.track_gemini_window)
  return Boolean(row.strict_mode_enabled)
}

export function buildQuizAntiCheatConfigFromDb(assessment: {
  strict_mode_enabled?: boolean | null
  block_copy_paste?: boolean | null
  track_tab_switches?: boolean | null
  track_mouse_movement?: boolean | null
  warn_on_tab_switch?: boolean | null
  max_tab_switches?: number | null
  auto_submit_on_violations?: boolean | null
  track_gemini_window?: boolean | null
  max_gemini_strikes?: number | null
  require_fullscreen?: boolean | null
  keystroke_playback_enforced?: boolean | null
}) {
  const strictModeEnabled = Boolean(assessment.strict_mode_enabled)
  return {
    strictModeEnabled,
    blockCopyPaste: Boolean(assessment.block_copy_paste),
    trackTabSwitches: Boolean(assessment.track_tab_switches),
    trackMouseMovement: Boolean(assessment.track_mouse_movement),
    warnOnTabSwitch: Boolean(assessment.warn_on_tab_switch),
    maxTabSwitches: Number(assessment.max_tab_switches) || 5,
    autoSubmitOnViolations: Boolean(assessment.auto_submit_on_violations),
    trackGeminiWindow: resolveTrackGeminiWindowFromDb(assessment),
    maxGeminiStrikes: Number(assessment.max_gemini_strikes) || 5,
    requireFullscreen: assessment.require_fullscreen === true,
    keystrokePlaybackEnforced: assessment.keystroke_playback_enforced !== false,
  }
}

