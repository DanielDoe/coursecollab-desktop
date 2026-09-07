/**
 * Quiz Superpowers - membership-gated runtime modifiers
 * Applies to quiz, homework, and mid-semester when enabled (not final exams)
 */

export const SUPERPOWER_IDS = [
  "copy_paste",
  "disable_tab_tracking",
  "disable_ai_detection",
  "increase_strikes",
  "extra_retake",
  "extra_time",
  "none",
] as const

export type SuperpowerId = (typeof SUPERPOWER_IDS)[number]

export interface SuperpowerConfig {
  id: SuperpowerId
  label: string
  description: string
  icon: string
}

export const SUPERPOWER_CONFIG: Record<SuperpowerId, SuperpowerConfig> = {
  copy_paste: {
    id: "copy_paste",
    label: "Copy/Paste Enabled",
    description: "Allow copying and pasting during the assessment",
    icon: "📋",
  },
  disable_tab_tracking: {
    id: "disable_tab_tracking",
    label: "No Tab Tracking",
    description: "Tab switches won't be monitored or counted",
    icon: "🔄",
  },
  disable_ai_detection: {
    id: "disable_ai_detection",
    label: "No AI Detection",
    description: "Browser AI tools won't be detected",
    icon: "🤖",
  },
  increase_strikes: {
    id: "increase_strikes",
    label: "Extra Strikes",
    description: "10 tab switches and 10 AI strikes allowed (instead of 5)",
    icon: "🛡️",
  },
  extra_retake: {
    id: "extra_retake",
    label: "+1 Retake",
    description: "One additional attempt for this assessment",
    icon: "🔄",
  },
  extra_time: {
    id: "extra_time",
    label: "+5 Min Coding",
    description: "5 extra minutes per code question (code_write, code_problem, debug_code)",
    icon: "⏱️",
  },
  none: {
    id: "none",
    label: "No Superpowers",
    description: "Take the assessment with standard settings",
    icon: "📝",
  },
}

/** Selection rules by membership tier */
export const SUPERPOWER_SELECTION_RULES = {
  Scholar: { min: 0, max: 0, message: "Upgrade to Explorer or Trailblazer to use superpowers" },
  Explorer: { min: 1, max: 1, message: "Select exactly 1 superpower" },
  Trailblazer: { min: 0, max: 2, message: "Select up to 2 superpowers (or none)" },
} as const
