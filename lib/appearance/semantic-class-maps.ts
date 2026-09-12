/**
 * Static Tailwind class strings for semantic roles.
 * Tailwind v4 only emits utilities it can see as literals — dynamic
 * `bg-[var(--cc-sem-${role}-soft)]` strings are ignored at build time.
 */

import type { SemanticRole } from "@/lib/appearance/semantic-tokens"

export const SEM_SOFT_TEXT: Record<SemanticRole, string> = {
  primary: "bg-[var(--cc-sem-primary-soft)] text-[var(--cc-sem-primary-text)]",
  secondary: "bg-[var(--cc-sem-secondary-soft)] text-[var(--cc-sem-secondary-text)]",
  success: "bg-[var(--cc-sem-success-soft)] text-[var(--cc-sem-success-text)]",
  warning: "bg-[var(--cc-sem-warning-soft)] text-[var(--cc-sem-warning-text)]",
  danger: "bg-[var(--cc-sem-danger-soft)] text-[var(--cc-sem-danger-text)]",
  info: "bg-[var(--cc-sem-info-soft)] text-[var(--cc-sem-info-text)]",
  reward: "bg-[var(--cc-sem-reward-soft)] text-[var(--cc-sem-reward-text)]",
  homework: "bg-[var(--cc-sem-homework-soft)] text-[var(--cc-sem-homework-text)]",
  attendance: "bg-[var(--cc-sem-attendance-soft)] text-[var(--cc-sem-attendance-text)]",
  quiz: "bg-[var(--cc-sem-quiz-soft)] text-[var(--cc-sem-quiz-text)]",
  codebench: "bg-[var(--cc-sem-codebench-soft)] text-[var(--cc-sem-codebench-text)]",
  ai: "bg-[var(--cc-sem-ai-soft)] text-[var(--cc-sem-ai-text)]",
  analytics: "bg-[var(--cc-sem-analytics-soft)] text-[var(--cc-sem-analytics-text)]",
  calendar: "bg-[var(--cc-sem-calendar-soft)] text-[var(--cc-sem-calendar-text)]",
  messages: "bg-[var(--cc-sem-messages-soft)] text-[var(--cc-sem-messages-text)]",
  projects: "bg-[var(--cc-sem-projects-soft)] text-[var(--cc-sem-projects-text)]",
  discussion: "bg-[var(--cc-sem-discussion-soft)] text-[var(--cc-sem-discussion-text)]",
  practice: "bg-[var(--cc-sem-practice-soft)] text-[var(--cc-sem-practice-text)]",
  neutral: "bg-[var(--cc-sem-neutral-soft)] text-[var(--cc-sem-neutral-text)]",
}

export const SEM_ICON_TEXT: Record<SemanticRole, string> = {
  primary: "text-[var(--cc-sem-primary-text)]",
  secondary: "text-[var(--cc-sem-secondary-text)]",
  success: "text-[var(--cc-sem-success-text)]",
  warning: "text-[var(--cc-sem-warning-text)]",
  danger: "text-[var(--cc-sem-danger-text)]",
  info: "text-[var(--cc-sem-info-text)]",
  reward: "text-[var(--cc-sem-reward-text)]",
  homework: "text-[var(--cc-sem-homework-text)]",
  attendance: "text-[var(--cc-sem-attendance-text)]",
  quiz: "text-[var(--cc-sem-quiz-text)]",
  codebench: "text-[var(--cc-sem-codebench-text)]",
  ai: "text-[var(--cc-sem-ai-text)]",
  analytics: "text-[var(--cc-sem-analytics-text)]",
  calendar: "text-[var(--cc-sem-calendar-text)]",
  messages: "text-[var(--cc-sem-messages-text)]",
  projects: "text-[var(--cc-sem-projects-text)]",
  discussion: "text-[var(--cc-sem-discussion-text)]",
  practice: "text-[var(--cc-sem-practice-text)]",
  neutral: "text-[var(--cc-sem-neutral-text)]",
}

export const SEM_SOFT_BG: Record<SemanticRole, string> = {
  primary: "bg-[var(--cc-sem-primary-soft)]",
  secondary: "bg-[var(--cc-sem-secondary-soft)]",
  success: "bg-[var(--cc-sem-success-soft)]",
  warning: "bg-[var(--cc-sem-warning-soft)]",
  danger: "bg-[var(--cc-sem-danger-soft)]",
  info: "bg-[var(--cc-sem-info-soft)]",
  reward: "bg-[var(--cc-sem-reward-soft)]",
  homework: "bg-[var(--cc-sem-homework-soft)]",
  attendance: "bg-[var(--cc-sem-attendance-soft)]",
  quiz: "bg-[var(--cc-sem-quiz-soft)]",
  codebench: "bg-[var(--cc-sem-codebench-soft)]",
  ai: "bg-[var(--cc-sem-ai-soft)]",
  analytics: "bg-[var(--cc-sem-analytics-soft)]",
  calendar: "bg-[var(--cc-sem-calendar-soft)]",
  messages: "bg-[var(--cc-sem-messages-soft)]",
  projects: "bg-[var(--cc-sem-projects-soft)]",
  discussion: "bg-[var(--cc-sem-discussion-soft)]",
  practice: "bg-[var(--cc-sem-practice-soft)]",
  neutral: "bg-[var(--cc-sem-neutral-soft)]",
}

export const SEM_BORDER: Record<SemanticRole, string> = {
  primary: "border-[var(--cc-sem-primary-border)]",
  secondary: "border-[var(--cc-sem-secondary-border)]",
  success: "border-[var(--cc-sem-success-border)]",
  warning: "border-[var(--cc-sem-warning-border)]",
  danger: "border-[var(--cc-sem-danger-border)]",
  info: "border-[var(--cc-sem-info-border)]",
  reward: "border-[var(--cc-sem-reward-border)]",
  homework: "border-[var(--cc-sem-homework-border)]",
  attendance: "border-[var(--cc-sem-attendance-border)]",
  quiz: "border-[var(--cc-sem-quiz-border)]",
  codebench: "border-[var(--cc-sem-codebench-border)]",
  ai: "border-[var(--cc-sem-ai-border)]",
  analytics: "border-[var(--cc-sem-analytics-border)]",
  calendar: "border-[var(--cc-sem-calendar-border)]",
  messages: "border-[var(--cc-sem-messages-border)]",
  projects: "border-[var(--cc-sem-projects-border)]",
  discussion: "border-[var(--cc-sem-discussion-border)]",
  practice: "border-[var(--cc-sem-practice-border)]",
  neutral: "border-[var(--cc-sem-neutral-border)]",
}

export const SEM_BADGE: Record<SemanticRole, string> = {
  primary:
    "bg-[var(--cc-sem-primary-soft)] text-[var(--cc-sem-primary-text)] border border-[var(--cc-sem-primary-border)]",
  secondary:
    "bg-[var(--cc-sem-secondary-soft)] text-[var(--cc-sem-secondary-text)] border border-[var(--cc-sem-secondary-border)]",
  success:
    "bg-[var(--cc-sem-success-soft)] text-[var(--cc-sem-success-text)] border border-[var(--cc-sem-success-border)]",
  warning:
    "bg-[var(--cc-sem-warning-soft)] text-[var(--cc-sem-warning-text)] border border-[var(--cc-sem-warning-border)]",
  danger:
    "bg-[var(--cc-sem-danger-soft)] text-[var(--cc-sem-danger-text)] border border-[var(--cc-sem-danger-border)]",
  info: "bg-[var(--cc-sem-info-soft)] text-[var(--cc-sem-info-text)] border border-[var(--cc-sem-info-border)]",
  reward:
    "bg-[var(--cc-sem-reward-soft)] text-[var(--cc-sem-reward-text)] border border-[var(--cc-sem-reward-border)]",
  homework:
    "bg-[var(--cc-sem-homework-soft)] text-[var(--cc-sem-homework-text)] border border-[var(--cc-sem-homework-border)]",
  attendance:
    "bg-[var(--cc-sem-attendance-soft)] text-[var(--cc-sem-attendance-text)] border border-[var(--cc-sem-attendance-border)]",
  quiz: "bg-[var(--cc-sem-quiz-soft)] text-[var(--cc-sem-quiz-text)] border border-[var(--cc-sem-quiz-border)]",
  codebench:
    "bg-[var(--cc-sem-codebench-soft)] text-[var(--cc-sem-codebench-text)] border border-[var(--cc-sem-codebench-border)]",
  ai: "bg-[var(--cc-sem-ai-soft)] text-[var(--cc-sem-ai-text)] border border-[var(--cc-sem-ai-border)]",
  analytics:
    "bg-[var(--cc-sem-analytics-soft)] text-[var(--cc-sem-analytics-text)] border border-[var(--cc-sem-analytics-border)]",
  calendar:
    "bg-[var(--cc-sem-calendar-soft)] text-[var(--cc-sem-calendar-text)] border border-[var(--cc-sem-calendar-border)]",
  messages:
    "bg-[var(--cc-sem-messages-soft)] text-[var(--cc-sem-messages-text)] border border-[var(--cc-sem-messages-border)]",
  projects:
    "bg-[var(--cc-sem-projects-soft)] text-[var(--cc-sem-projects-text)] border border-[var(--cc-sem-projects-border)]",
  discussion:
    "bg-[var(--cc-sem-discussion-soft)] text-[var(--cc-sem-discussion-text)] border border-[var(--cc-sem-discussion-border)]",
  practice:
    "bg-[var(--cc-sem-practice-soft)] text-[var(--cc-sem-practice-text)] border border-[var(--cc-sem-practice-border)]",
  neutral:
    "bg-[var(--cc-sem-neutral-soft)] text-[var(--cc-sem-neutral-text)] border border-[var(--cc-sem-neutral-border)]",
}

export const SEM_PROGRESS: Record<SemanticRole, string> = {
  primary: "bg-[var(--cc-sem-primary)]",
  secondary: "bg-[var(--cc-sem-secondary)]",
  success: "bg-[var(--cc-sem-success)]",
  warning: "bg-[var(--cc-sem-warning)]",
  danger: "bg-[var(--cc-sem-danger)]",
  info: "bg-[var(--cc-sem-info)]",
  reward: "bg-[var(--cc-sem-reward)]",
  homework: "bg-[var(--cc-sem-homework)]",
  attendance: "bg-[var(--cc-sem-attendance)]",
  quiz: "bg-[var(--cc-sem-quiz)]",
  codebench: "bg-[var(--cc-sem-codebench)]",
  ai: "bg-[var(--cc-sem-ai)]",
  analytics: "bg-[var(--cc-sem-analytics)]",
  calendar: "bg-[var(--cc-sem-calendar)]",
  messages: "bg-[var(--cc-sem-messages)]",
  projects: "bg-[var(--cc-sem-projects)]",
  discussion: "bg-[var(--cc-sem-discussion)]",
  practice: "bg-[var(--cc-sem-practice)]",
  neutral: "bg-[var(--cc-sem-neutral)]",
}

export const SEM_SPINNER: Record<SemanticRole, string> = {
  primary: "border-t-[var(--cc-sem-primary)]",
  secondary: "border-t-[var(--cc-sem-secondary)]",
  success: "border-t-[var(--cc-sem-success)]",
  warning: "border-t-[var(--cc-sem-warning)]",
  danger: "border-t-[var(--cc-sem-danger)]",
  info: "border-t-[var(--cc-sem-info)]",
  reward: "border-t-[var(--cc-sem-reward)]",
  homework: "border-t-[var(--cc-sem-homework)]",
  attendance: "border-t-[var(--cc-sem-attendance)]",
  quiz: "border-t-[var(--cc-sem-quiz)]",
  codebench: "border-t-[var(--cc-sem-codebench)]",
  ai: "border-t-[var(--cc-sem-ai)]",
  analytics: "border-t-[var(--cc-sem-analytics)]",
  calendar: "border-t-[var(--cc-sem-calendar)]",
  messages: "border-t-[var(--cc-sem-messages)]",
  projects: "border-t-[var(--cc-sem-projects)]",
  discussion: "border-t-[var(--cc-sem-discussion)]",
  practice: "border-t-[var(--cc-sem-practice)]",
  neutral: "border-t-[var(--cc-sem-neutral)]",
}

/** Radix Switch — checked track uses module semantic base (not global --primary). */
export const SEM_SWITCH_CHECKED: Record<SemanticRole, string> = {
  primary: "data-[state=checked]:bg-[var(--cc-sem-primary)]",
  secondary: "data-[state=checked]:bg-[var(--cc-sem-secondary)]",
  success: "data-[state=checked]:bg-[var(--cc-sem-success)]",
  warning: "data-[state=checked]:bg-[var(--cc-sem-warning)]",
  danger: "data-[state=checked]:bg-[var(--cc-sem-danger)]",
  info: "data-[state=checked]:bg-[var(--cc-sem-info)]",
  reward: "data-[state=checked]:bg-[var(--cc-sem-reward)]",
  homework: "data-[state=checked]:bg-[var(--cc-sem-homework)]",
  attendance: "data-[state=checked]:bg-[var(--cc-sem-attendance)]",
  quiz: "data-[state=checked]:bg-[var(--cc-sem-quiz)]",
  codebench: "data-[state=checked]:bg-[var(--cc-sem-codebench)]",
  ai: "data-[state=checked]:bg-[var(--cc-sem-ai)]",
  analytics: "data-[state=checked]:bg-[var(--cc-sem-analytics)]",
  calendar: "data-[state=checked]:bg-[var(--cc-sem-calendar)]",
  messages: "data-[state=checked]:bg-[var(--cc-sem-messages)]",
  projects: "data-[state=checked]:bg-[var(--cc-sem-projects)]",
  discussion: "data-[state=checked]:bg-[var(--cc-sem-discussion)]",
  practice: "data-[state=checked]:bg-[var(--cc-sem-practice)]",
  neutral: "data-[state=checked]:bg-[var(--cc-sem-neutral)]",
}

/** Slider range + thumb border tied to module semantic base. */
export const SEM_SLIDER: Record<SemanticRole, string> = {
  primary:
    "[&_[data-slot=slider-range]]:bg-[var(--cc-sem-primary)] [&_[data-slot=slider-thumb]]:border-[var(--cc-sem-primary)]",
  secondary:
    "[&_[data-slot=slider-range]]:bg-[var(--cc-sem-secondary)] [&_[data-slot=slider-thumb]]:border-[var(--cc-sem-secondary)]",
  success:
    "[&_[data-slot=slider-range]]:bg-[var(--cc-sem-success)] [&_[data-slot=slider-thumb]]:border-[var(--cc-sem-success)]",
  warning:
    "[&_[data-slot=slider-range]]:bg-[var(--cc-sem-warning)] [&_[data-slot=slider-thumb]]:border-[var(--cc-sem-warning)]",
  danger:
    "[&_[data-slot=slider-range]]:bg-[var(--cc-sem-danger)] [&_[data-slot=slider-thumb]]:border-[var(--cc-sem-danger)]",
  info: "[&_[data-slot=slider-range]]:bg-[var(--cc-sem-info)] [&_[data-slot=slider-thumb]]:border-[var(--cc-sem-info)]",
  reward:
    "[&_[data-slot=slider-range]]:bg-[var(--cc-sem-reward)] [&_[data-slot=slider-thumb]]:border-[var(--cc-sem-reward)]",
  homework:
    "[&_[data-slot=slider-range]]:bg-[var(--cc-sem-homework)] [&_[data-slot=slider-thumb]]:border-[var(--cc-sem-homework)]",
  attendance:
    "[&_[data-slot=slider-range]]:bg-[var(--cc-sem-attendance)] [&_[data-slot=slider-thumb]]:border-[var(--cc-sem-attendance)]",
  quiz: "[&_[data-slot=slider-range]]:bg-[var(--cc-sem-quiz)] [&_[data-slot=slider-thumb]]:border-[var(--cc-sem-quiz)]",
  codebench:
    "[&_[data-slot=slider-range]]:bg-[var(--cc-sem-codebench)] [&_[data-slot=slider-thumb]]:border-[var(--cc-sem-codebench)]",
  ai: "[&_[data-slot=slider-range]]:bg-[var(--cc-sem-ai)] [&_[data-slot=slider-thumb]]:border-[var(--cc-sem-ai)]",
  analytics:
    "[&_[data-slot=slider-range]]:bg-[var(--cc-sem-analytics)] [&_[data-slot=slider-thumb]]:border-[var(--cc-sem-analytics)]",
  calendar:
    "[&_[data-slot=slider-range]]:bg-[var(--cc-sem-calendar)] [&_[data-slot=slider-thumb]]:border-[var(--cc-sem-calendar)]",
  messages:
    "[&_[data-slot=slider-range]]:bg-[var(--cc-sem-messages)] [&_[data-slot=slider-thumb]]:border-[var(--cc-sem-messages)]",
  projects:
    "[&_[data-slot=slider-range]]:bg-[var(--cc-sem-projects)] [&_[data-slot=slider-thumb]]:border-[var(--cc-sem-projects)]",
  discussion:
    "[&_[data-slot=slider-range]]:bg-[var(--cc-sem-discussion)] [&_[data-slot=slider-thumb]]:border-[var(--cc-sem-discussion)]",
  practice:
    "[&_[data-slot=slider-range]]:bg-[var(--cc-sem-practice)] [&_[data-slot=slider-thumb]]:border-[var(--cc-sem-practice)]",
  neutral:
    "[&_[data-slot=slider-range]]:bg-[var(--cc-sem-neutral)] [&_[data-slot=slider-thumb]]:border-[var(--cc-sem-neutral)]",
}

export const SEM_CTA: Record<SemanticRole, string> = {
  primary: "bg-[var(--cc-sem-primary)] hover:bg-[var(--cc-sem-primary-hover)] text-white shadow-sm",
  secondary: "bg-[var(--cc-sem-secondary)] hover:bg-[var(--cc-sem-secondary-hover)] text-white shadow-sm",
  success: "bg-[var(--cc-sem-success)] hover:bg-[var(--cc-sem-success-hover)] text-white shadow-sm",
  warning: "bg-[var(--cc-sem-warning)] hover:bg-[var(--cc-sem-warning-hover)] text-white shadow-sm",
  danger: "bg-[var(--cc-sem-danger)] hover:bg-[var(--cc-sem-danger-hover)] text-white shadow-sm",
  info: "bg-[var(--cc-sem-info)] hover:bg-[var(--cc-sem-info-hover)] text-white shadow-sm",
  reward: "bg-[var(--cc-sem-reward)] hover:bg-[var(--cc-sem-reward-hover)] !text-white shadow-sm",
  homework: "bg-[var(--cc-sem-homework)] hover:bg-[var(--cc-sem-homework-hover)] text-white shadow-sm",
  attendance: "bg-[var(--cc-sem-attendance)] hover:bg-[var(--cc-sem-attendance-hover)] text-white shadow-sm",
  quiz: "bg-[var(--cc-sem-quiz)] hover:bg-[var(--cc-sem-quiz-hover)] text-white shadow-sm",
  codebench: "bg-[var(--cc-sem-codebench)] hover:bg-[var(--cc-sem-codebench-hover)] text-white shadow-sm",
  ai: "bg-[var(--cc-sem-ai)] hover:bg-[var(--cc-sem-ai-hover)] text-white shadow-sm",
  analytics: "bg-[var(--cc-sem-analytics)] hover:bg-[var(--cc-sem-analytics-hover)] text-white shadow-sm",
  calendar: "bg-[var(--cc-sem-calendar)] hover:bg-[var(--cc-sem-calendar-hover)] text-white shadow-sm",
  messages: "bg-[var(--cc-sem-messages)] hover:bg-[var(--cc-sem-messages-hover)] text-white shadow-sm",
  projects: "bg-[var(--cc-sem-projects)] hover:bg-[var(--cc-sem-projects-hover)] text-white shadow-sm",
  discussion: "bg-[var(--cc-sem-discussion)] hover:bg-[var(--cc-sem-discussion-hover)] text-white shadow-sm",
  practice: "bg-[var(--cc-sem-practice)] hover:bg-[var(--cc-sem-practice-hover)] text-white shadow-sm",
  neutral: "bg-[var(--muted)] hover:bg-[var(--border)] text-[var(--cc-text)]",
}

export const SEM_OUTLINE: Record<SemanticRole, string> = {
  primary:
    "border border-[var(--cc-sem-primary-border)] text-[var(--cc-sem-primary-text)] hover:bg-[var(--cc-sem-primary-soft)]",
  secondary:
    "border border-[var(--cc-sem-secondary-border)] text-[var(--cc-sem-secondary-text)] hover:bg-[var(--cc-sem-secondary-soft)]",
  success:
    "border border-[var(--cc-sem-success-border)] text-[var(--cc-sem-success-text)] hover:bg-[var(--cc-sem-success-soft)]",
  warning:
    "border border-[var(--cc-sem-warning-border)] text-[var(--cc-sem-warning-text)] hover:bg-[var(--cc-sem-warning-soft)]",
  danger:
    "border border-[var(--cc-sem-danger-border)] text-[var(--cc-sem-danger-text)] hover:bg-[var(--cc-sem-danger-soft)]",
  info: "border border-[var(--cc-sem-info-border)] text-[var(--cc-sem-info-text)] hover:bg-[var(--cc-sem-info-soft)]",
  reward:
    "border border-[var(--cc-sem-reward-border)] text-[var(--cc-sem-reward-text)] hover:bg-[var(--cc-sem-reward-soft)]",
  homework:
    "border border-[var(--cc-sem-homework-border)] text-[var(--cc-sem-homework-text)] hover:bg-[var(--cc-sem-homework-soft)]",
  attendance:
    "border border-[var(--cc-sem-attendance-border)] text-[var(--cc-sem-attendance-text)] hover:bg-[var(--cc-sem-attendance-soft)]",
  quiz: "border border-[var(--cc-sem-quiz-border)] text-[var(--cc-sem-quiz-text)] hover:bg-[var(--cc-sem-quiz-soft)]",
  codebench:
    "border border-[var(--cc-sem-codebench-border)] text-[var(--cc-sem-codebench-text)] hover:bg-[var(--cc-sem-codebench-soft)]",
  ai: "border border-[var(--cc-sem-ai-border)] text-[var(--cc-sem-ai-text)] hover:bg-[var(--cc-sem-ai-soft)]",
  analytics:
    "border border-[var(--cc-sem-analytics-border)] text-[var(--cc-sem-analytics-text)] hover:bg-[var(--cc-sem-analytics-soft)]",
  calendar:
    "border border-[var(--cc-sem-calendar-border)] text-[var(--cc-sem-calendar-text)] hover:bg-[var(--cc-sem-calendar-soft)]",
  messages:
    "border border-[var(--cc-sem-messages-border)] text-[var(--cc-sem-messages-text)] hover:bg-[var(--cc-sem-messages-soft)]",
  projects:
    "border border-[var(--cc-sem-projects-border)] text-[var(--cc-sem-projects-text)] hover:bg-[var(--cc-sem-projects-soft)]",
  discussion:
    "border border-[var(--cc-sem-discussion-border)] text-[var(--cc-sem-discussion-text)] hover:bg-[var(--cc-sem-discussion-soft)]",
  practice:
    "border border-[var(--cc-sem-practice-border)] text-[var(--cc-sem-practice-text)] hover:bg-[var(--cc-sem-practice-soft)]",
  neutral:
    "border border-[var(--cc-sem-neutral-border)] text-[var(--cc-sem-neutral-text)] hover:bg-[var(--cc-sem-neutral-soft)]",
}

export const SEM_TAB_ACTIVE: Record<SemanticRole, string> = {
  primary:
    "data-[state=active]:bg-[var(--cc-sem-primary-soft)] data-[state=active]:text-[var(--cc-sem-primary-text)]",
  secondary:
    "data-[state=active]:bg-[var(--cc-sem-secondary-soft)] data-[state=active]:text-[var(--cc-sem-secondary-text)]",
  success:
    "data-[state=active]:bg-[var(--cc-sem-success-soft)] data-[state=active]:text-[var(--cc-sem-success-text)]",
  warning:
    "data-[state=active]:bg-[var(--cc-sem-warning-soft)] data-[state=active]:text-[var(--cc-sem-warning-text)]",
  danger:
    "data-[state=active]:bg-[var(--cc-sem-danger-soft)] data-[state=active]:text-[var(--cc-sem-danger-text)]",
  info: "data-[state=active]:bg-[var(--cc-sem-info-soft)] data-[state=active]:text-[var(--cc-sem-info-text)]",
  reward:
    "data-[state=active]:bg-[var(--cc-sem-reward-soft)] data-[state=active]:text-[var(--cc-sem-reward-text)]",
  homework:
    "data-[state=active]:bg-[var(--cc-sem-homework-soft)] data-[state=active]:text-[var(--cc-sem-homework-text)]",
  attendance:
    "data-[state=active]:bg-[var(--cc-sem-attendance-soft)] data-[state=active]:text-[var(--cc-sem-attendance-text)]",
  quiz: "data-[state=active]:bg-[var(--cc-sem-quiz-soft)] data-[state=active]:text-[var(--cc-sem-quiz-text)]",
  codebench:
    "data-[state=active]:bg-[var(--cc-sem-codebench-soft)] data-[state=active]:text-[var(--cc-sem-codebench-text)]",
  ai: "data-[state=active]:bg-[var(--cc-sem-ai-soft)] data-[state=active]:text-[var(--cc-sem-ai-text)]",
  analytics:
    "data-[state=active]:bg-[var(--cc-sem-analytics-soft)] data-[state=active]:text-[var(--cc-sem-analytics-text)]",
  calendar:
    "data-[state=active]:bg-[var(--cc-sem-calendar-soft)] data-[state=active]:text-[var(--cc-sem-calendar-text)]",
  messages:
    "data-[state=active]:bg-[var(--cc-sem-messages-soft)] data-[state=active]:text-[var(--cc-sem-messages-text)]",
  projects:
    "data-[state=active]:bg-[var(--cc-sem-projects-soft)] data-[state=active]:text-[var(--cc-sem-projects-text)]",
  discussion:
    "data-[state=active]:bg-[var(--cc-sem-discussion-soft)] data-[state=active]:text-[var(--cc-sem-discussion-text)]",
  practice:
    "data-[state=active]:bg-[var(--cc-sem-practice-soft)] data-[state=active]:text-[var(--cc-sem-practice-text)]",
  neutral:
    "data-[state=active]:bg-[var(--cc-sem-neutral-soft)] data-[state=active]:text-[var(--cc-sem-neutral-text)]",
}

export const SEM_GLOW: Record<SemanticRole, string> = {
  primary: "shadow-[0_0_24px_var(--cc-sem-primary-glow)]",
  secondary: "shadow-[0_0_24px_var(--cc-sem-secondary-glow)]",
  success: "shadow-[0_0_24px_var(--cc-sem-success-glow)]",
  warning: "shadow-[0_0_24px_var(--cc-sem-warning-glow)]",
  danger: "shadow-[0_0_24px_var(--cc-sem-danger-glow)]",
  info: "shadow-[0_0_24px_var(--cc-sem-info-glow)]",
  reward: "shadow-[0_0_24px_var(--cc-sem-reward-glow)]",
  homework: "shadow-[0_0_24px_var(--cc-sem-homework-glow)]",
  attendance: "shadow-[0_0_24px_var(--cc-sem-attendance-glow)]",
  quiz: "shadow-[0_0_24px_var(--cc-sem-quiz-glow)]",
  codebench: "shadow-[0_0_24px_var(--cc-sem-codebench-glow)]",
  ai: "shadow-[0_0_24px_var(--cc-sem-ai-glow)]",
  analytics: "shadow-[0_0_24px_var(--cc-sem-analytics-glow)]",
  calendar: "shadow-[0_0_24px_var(--cc-sem-calendar-glow)]",
  messages: "shadow-[0_0_24px_var(--cc-sem-messages-glow)]",
  projects: "shadow-[0_0_24px_var(--cc-sem-projects-glow)]",
  discussion: "shadow-[0_0_24px_var(--cc-sem-discussion-glow)]",
  practice: "shadow-[0_0_24px_var(--cc-sem-practice-glow)]",
  neutral: "shadow-[0_0_24px_var(--cc-sem-neutral-glow)]",
}
