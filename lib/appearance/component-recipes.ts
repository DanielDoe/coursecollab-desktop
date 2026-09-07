/**
 * Component recipes — map semantic roles to Tailwind classes.
 * Components use these helpers instead of raw color utilities.
 */

import type { SemanticRole } from "@/lib/appearance/semantic-tokens"
import {
  SEM_BADGE,
  SEM_BORDER,
  SEM_CTA,
  SEM_SLIDER,
  SEM_SWITCH_CHECKED,
  SEM_GLOW,
  SEM_ICON_TEXT,
  SEM_OUTLINE,
  SEM_PROGRESS,
  SEM_SOFT_BG,
  SEM_SOFT_TEXT,
  SEM_SPINNER,
  SEM_TAB_ACTIVE,
} from "@/lib/appearance/semantic-class-maps"

/** Icon well on cards / page headers */
export function semanticIconWell(role: SemanticRole): string {
  return SEM_SOFT_TEXT[role]
}

/** Inline icon accent */
export function semanticIcon(role: SemanticRole): string {
  return SEM_ICON_TEXT[role]
}

/** Status / category badge */
export function semanticBadge(role: SemanticRole): string {
  return SEM_BADGE[role]
}

/** Soft section background */
export function semanticSoftBg(role: SemanticRole): string {
  return SEM_SOFT_BG[role]
}

/** Accent border */
export function semanticBorder(role: SemanticRole): string {
  return SEM_BORDER[role]
}

/** Progress / chart fill */
export function semanticProgress(role: SemanticRole): string {
  return SEM_PROGRESS[role]
}

/** Spinner ring */
export function semanticSpinner(role: SemanticRole): string {
  return SEM_SPINNER[role]
}

/** CTA button for a semantic module */
export function semanticCta(role: SemanticRole): string {
  return SEM_CTA[role]
}

/** Radix Switch checked track */
export function semanticSwitchChecked(role: SemanticRole): string {
  return SEM_SWITCH_CHECKED[role]
}

/** Slider range + thumb accent */
export function semanticSlider(role: SemanticRole): string {
  return SEM_SLIDER[role]
}

/** Card accent glow (subtle) */
export function semanticGlow(role: SemanticRole): string {
  return SEM_GLOW[role]
}

/** Outline / secondary action tied to semantic role */
export function semanticOutline(role: SemanticRole): string {
  return SEM_OUTLINE[role]
}

/** Full page module token set (sidebar + page chrome) */
export function semanticPageTokens(role: SemanticRole) {
  return {
    iconBg: semanticSoftBg(role),
    iconText: semanticIcon(role),
    tabActive: SEM_TAB_ACTIVE[role],
    badge: semanticBadge(role),
    softBg: semanticSoftBg(role),
    border: semanticBorder(role),
    spinner: semanticSpinner(role),
    progress: semanticProgress(role),
    cta: semanticCta(role),
    switchChecked: semanticSwitchChecked(role),
    slider: semanticSlider(role),
  }
}

/** Sidebar nav — idle icon well uses module semantic; active uses primary */
export function semanticNavIconIdle(role: SemanticRole): string {
  return SEM_SOFT_TEXT[role]
}

export function semanticNavIconActive(): string {
  return "bg-[var(--pv-sidebar-active-icon-bg)] text-[var(--cc-drawer-primary)]"
}

export function semanticNavLinkActive(): string {
  return "bg-[var(--cc-drawer-nav-active-bg)] text-[var(--cc-drawer-primary)] border border-[var(--cc-drawer-nav-active-border)] shadow-sm"
}

export function semanticNavLinkIdle(): string {
  return "text-[var(--cc-drawer-label-secondary)] hover:bg-[var(--cc-drawer-nav-hover-bg)] hover:text-[var(--cc-drawer-label)]"
}

/** Button variant class strings */
export const SEMANTIC_BUTTON = {
  primary: "bg-[var(--cc-sem-primary)] hover:bg-[var(--cc-sem-primary-hover)] text-white shadow-xs",
  secondary: "border border-[var(--border)] bg-[var(--card)] text-[var(--cc-text)] hover:bg-[var(--muted)] shadow-xs",
  ghost: "hover:bg-[var(--muted)] text-[var(--cc-text-secondary)] hover:text-[var(--cc-text)]",
  success: "bg-[var(--cc-sem-success)] hover:bg-[var(--cc-sem-success-hover)] text-white shadow-xs",
  warning: "bg-[var(--cc-sem-warning)] hover:bg-[var(--cc-sem-warning-hover)] text-white shadow-xs",
  danger: "bg-[var(--cc-sem-danger)] hover:bg-[var(--cc-sem-danger-hover)] text-white shadow-xs",
  info: "bg-[var(--cc-sem-info)] hover:bg-[var(--cc-sem-info-hover)] text-white shadow-xs",
  premium: "bg-[var(--cc-sem-reward)] hover:bg-[var(--cc-sem-reward-hover)] text-[#422006] shadow-xs",
} as const

/** Badge variant class strings */
export const SEMANTIC_BADGE = {
  default: "border-transparent bg-[var(--cc-sem-primary)] text-white",
  success: semanticBadge("success"),
  warning: semanticBadge("warning"),
  danger: semanticBadge("danger"),
  info: semanticBadge("info"),
  premium: semanticBadge("reward"),
  ai: semanticBadge("ai"),
  homework: semanticBadge("homework"),
  attendance: semanticBadge("attendance"),
  analytics: semanticBadge("analytics"),
  discussion: semanticBadge("discussion"),
  neutral: semanticBadge("neutral"),
} as const

export type SemanticBadgeVariant = keyof typeof SEMANTIC_BADGE
export type SemanticButtonVariant = keyof typeof SEMANTIC_BUTTON

/** Resolve module/widget id → semantic role for KPI cards & charts */
export type DashboardSemanticType =
  | "attendance"
  | "homework"
  | "quiz"
  | "discussion"
  | "projects"
  | "grades"
  | "reward"
  | "ai"
  | "codebench"
  | "calendar"
  | "analytics"
  | "primary"
  | "neutral"
  | "success"
  | "warning"
  | "danger"
  | "info"

export function dashboardSemanticRole(type: DashboardSemanticType): SemanticRole {
  if (type === "grades") return "primary"
  if (type === "discussion") return "discussion"
  if (type === "warning") return "warning"
  if (type === "success") return "success"
  if (type === "danger") return "danger"
  if (type === "info") return "info"
  return type
}
