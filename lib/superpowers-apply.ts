/**
 * Apply superpower overrides to quiz config
 * Merges base config with attempt-level overrides (never replaces, only overrides)
 */

export interface SuperpowerOverrides {
  superpowers?: string[]
  strikeLimitOverride?: number
  allowCopyPaste?: boolean
  disableTabTracking?: boolean
  disableAIDetection?: boolean
  extraTimePerQuestion?: number
  extraRetakeGranted?: boolean
}

export interface AntiCheatConfig {
  strictModeEnabled?: boolean
  blockCopyPaste?: boolean
  trackTabSwitches?: boolean
  trackMouseMovement?: boolean
  warnOnTabSwitch?: boolean
  maxTabSwitches?: number
  autoSubmitOnViolations?: boolean
  trackGeminiWindow?: boolean
  maxGeminiStrikes?: number
  requireFullscreen?: boolean
  keystrokePlaybackEnforced?: boolean
}

export function applySuperpowerOverrides(
  base: AntiCheatConfig,
  overrides: SuperpowerOverrides | null | undefined
): AntiCheatConfig {
  const hasSuperpowers = overrides?.superpowers && overrides.superpowers.length > 0
  const hasColumnOverrides = overrides?.disableTabTracking === true ||
    overrides?.disableAIDetection === true ||
    overrides?.allowCopyPaste === true
  if (!hasSuperpowers && !hasColumnOverrides) return base

  const result = { ...base }
  const sp = overrides?.superpowers ?? []

  if (sp.includes("copy_paste")) {
    result.blockCopyPaste = false
  }
  if (sp.includes("disable_tab_tracking")) {
    result.trackTabSwitches = false
    result.warnOnTabSwitch = false
    // Students with No Tab Tracking can switch tabs; fullscreen would block that
    result.requireFullscreen = false
  }
  if (sp.includes("disable_ai_detection")) {
    result.trackGeminiWindow = false
  }
  if (sp.includes("increase_strikes")) {
    result.maxTabSwitches = overrides.strikeLimitOverride ?? 10
    result.maxGeminiStrikes = overrides.strikeLimitOverride ?? 10
  }
  if (overrides.allowCopyPaste === true) result.blockCopyPaste = false
  if (overrides.disableTabTracking === true) {
    result.trackTabSwitches = false
    result.warnOnTabSwitch = false
  }
  if (overrides.disableAIDetection === true) result.trackGeminiWindow = false

  return result
}

export function computeSuperpowerOverrides(superpowers: string[]): SuperpowerOverrides {
  const overrides: SuperpowerOverrides = { superpowers }
  if (superpowers.includes("copy_paste")) overrides.allowCopyPaste = true
  if (superpowers.includes("disable_tab_tracking")) overrides.disableTabTracking = true
  if (superpowers.includes("disable_ai_detection")) overrides.disableAIDetection = true
  if (superpowers.includes("increase_strikes")) {
    overrides.strikeLimitOverride = 10
  }
  if (superpowers.includes("extra_time")) overrides.extraTimePerQuestion = 300
  if (superpowers.includes("extra_retake")) overrides.extraRetakeGranted = true
  return overrides
}

/**
 * Superpower UI, start-quiz persistence, and take-route anti-cheat overrides
 * for regular assessments. Not final exams, practice, or classroom points.
 */
export function assessmentTypeSupportsSuperpowers(
  assessmentType: string | null | undefined,
): boolean {
  const t = String(assessmentType ?? "")
    .toLowerCase()
    .trim()
  return (
    t === "quiz" ||
    t === "homework" ||
    t === "mid_semester" ||
    t === "mid-semester" ||
    t === "midsem"
  )
}
