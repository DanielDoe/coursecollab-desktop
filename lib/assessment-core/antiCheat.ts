/**
 * Shared Anti-Cheat Logic
 * 
 * Handles anti-cheat validation and configuration
 * for all assessment types.
 */

import { sql } from "@/lib/db"
import { getAssessmentConfig, type AssessmentType } from "./db"

export interface AntiCheatConfig {
  strictModeEnabled: boolean
  blockCopyPaste: boolean
  trackTabSwitches: boolean
  trackMouseMovement: boolean
  warnOnTabSwitch: boolean
  maxTabSwitches: number
  autoSubmitOnViolations: boolean
  webcamRequired?: boolean
  screenLockEnabled?: boolean
  ipTracking?: boolean
  exceptions?: string[] // Question types exempt from anti-cheat
}

export interface ViolationData {
  tabSwitches: number
  copyPasteDetected: boolean
  mouseMovementDetected: boolean
  otherViolations?: string[]
}

/**
 * Get anti-cheat configuration for an assessment
 */
export async function getAntiCheatConfig(
  assessmentType: AssessmentType,
  assessmentId: number
): Promise<AntiCheatConfig> {
  const config = getAssessmentConfig(assessmentType)

  const assessments = await sql`
    SELECT 
      strict_mode_enabled,
      block_copy_paste,
      track_tab_switches,
      track_mouse_movement,
      warn_on_tab_switch,
      max_tab_switches,
      auto_submit_on_violations
    FROM ${sql.unsafe(config.tableName)}
    WHERE id = ${assessmentId}
  `
  const assessment = assessments[0]

  if (!assessment) {
    // Return default config
    return {
      strictModeEnabled: false,
      blockCopyPaste: false,
      trackTabSwitches: false,
      trackMouseMovement: false,
      warnOnTabSwitch: false,
      maxTabSwitches: 5,
      autoSubmitOnViolations: false,
      exceptions: []
    }
  }

  return {
    strictModeEnabled: assessment.strict_mode_enabled || false,
    blockCopyPaste: assessment.block_copy_paste || false,
    trackTabSwitches: assessment.track_tab_switches || false,
    trackMouseMovement: assessment.track_mouse_movement || false,
    warnOnTabSwitch: assessment.warn_on_tab_switch || false,
    maxTabSwitches: assessment.max_tab_switches || 5,
    autoSubmitOnViolations: assessment.auto_submit_on_violations || false,
    exceptions: [] // Can be extended to read from question-level configs
  }
}

/**
 * Check if a question type is exempt from anti-cheat
 */
export function isQuestionExempt(
  questionType: string,
  config: AntiCheatConfig
): boolean {
  const exemptTypes = ['code_write_plot', 'code_problem'] // MATLAB and complex code questions
  return config.exceptions?.includes(questionType) || exemptTypes.includes(questionType)
}

/**
 * Check if violations should trigger auto-submit
 */
export function shouldAutoSubmitOnViolations(
  config: AntiCheatConfig,
  violations: ViolationData,
  questionType?: string
): boolean {
  if (!config.autoSubmitOnViolations) {
    return false
  }

  // Check if question is exempt
  if (questionType && isQuestionExempt(questionType, config)) {
    return false
  }

  if (config.trackTabSwitches && violations.tabSwitches > config.maxTabSwitches) {
    return true
  }

  if (config.blockCopyPaste && violations.copyPasteDetected) {
    return true
  }

  return false
}

/**
 * Validate anti-cheat rules for an attempt
 */
export async function validateAntiCheat(
  assessmentType: AssessmentType,
  assessmentId: number,
  violations: ViolationData,
  questionType?: string
): Promise<{
  isValid: boolean
  shouldAutoSubmit: boolean
  warnings: string[]
}> {
  const config = await getAntiCheatConfig(assessmentType, assessmentId)
  const warnings: string[] = []

  // Check tab switches
  if (config.trackTabSwitches && violations.tabSwitches > 0) {
    if (config.warnOnTabSwitch) {
      warnings.push(`Tab switch detected (${violations.tabSwitches} times)`)
    }
    if (violations.tabSwitches > config.maxTabSwitches) {
      return {
        isValid: false,
        shouldAutoSubmit: true,
        warnings
      }
    }
  }

  // Check copy/paste
  if (config.blockCopyPaste && violations.copyPasteDetected) {
    return {
      isValid: false,
      shouldAutoSubmit: true,
      warnings: [...warnings, 'Copy/paste detected']
    }
  }

  const shouldAutoSubmit = shouldAutoSubmitOnViolations(config, violations, questionType)

  return {
    isValid: !shouldAutoSubmit,
    shouldAutoSubmit,
    warnings
  }
}

