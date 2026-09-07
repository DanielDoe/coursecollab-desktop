/**
 * Student results summary chrome — jeans-card light mode, elevated dark,
 * section tones + KPI accents from Appearance Color Hunt swatches.
 */

import type { ChromeSwatch } from "@/lib/appearance/module-chrome"
import { cn } from "@/lib/utils"
import type { CSSProperties } from "react"

/** Light-mode interactive card shell (jeans sample). */
export const RESULTS_JEANS_CARD = cn(
  "relative overflow-hidden rounded-xl border border-gray-200 bg-white shadow-md",
  "transition-all duration-300 hover:shadow-lg",
)

export const RESULTS_JEANS_CARD_STATIC = cn(
  "relative overflow-hidden rounded-xl border border-gray-200 bg-white shadow-md",
)

/** Soft hover wash layer for jeans cards (place inside relative host). */
export const RESULTS_JEANS_HOVER_WASH =
  "pointer-events-none absolute inset-0 bg-gradient-to-br from-gray-100 to-white opacity-0 blur-md transition-opacity duration-500 group-hover:opacity-30"

/** Dark elevated fill/outline — apply via style when isDark. */
export function resultsDarkElevatedStyle(): CSSProperties {
  return {
    backgroundColor: "color-mix(in srgb, var(--card) 78%, white)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08), 0 8px 22px rgba(0,0,0,0.5)",
    outline: "1px solid rgba(255,255,255,0.22)",
    outlineOffset: 0,
  }
}

export function resultsPanelClass(isDark: boolean, interactive = true) {
  if (isDark) {
    return cn(
      "relative overflow-hidden rounded-xl transition-all duration-300",
      interactive && "hover:brightness-110",
    )
  }
  return interactive ? cn(RESULTS_JEANS_CARD, "group") : RESULTS_JEANS_CARD_STATIC
}

export type ResultsSectionTone = {
  shell: string
  title: string
  meta: string
  pct: string
  badge: string
  pointsLabel: string
  pointsValue: string
}

/** Strong / medium / weak section breakdown tones. */
export function resultsSectionTone(pct: number): ResultsSectionTone {
  if (pct >= 90) {
    return {
      shell:
        "border-emerald-300 bg-gradient-to-br from-emerald-50 to-teal-50/80 shadow-md ring-1 ring-emerald-200/80 dark:border-emerald-700/60 dark:from-emerald-950/50 dark:to-teal-950/35 dark:ring-emerald-800/40",
      title: "text-gray-800 dark:text-emerald-50",
      meta: "text-gray-700 dark:text-emerald-200/90",
      pct: "text-emerald-700 dark:text-emerald-300",
      badge: "bg-emerald-500/20 text-emerald-800 dark:bg-emerald-500/25 dark:text-emerald-200",
      pointsLabel: "text-gray-700 dark:text-emerald-200/80",
      pointsValue: "text-gray-900 dark:text-emerald-50",
    }
  }
  if (pct >= 50) {
    return {
      shell:
        "border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50/80 shadow-md ring-1 ring-amber-200/80 dark:border-amber-700/60 dark:from-amber-950/45 dark:to-orange-950/30 dark:ring-amber-800/40",
      title: "text-gray-800 dark:text-amber-50",
      meta: "text-gray-700 dark:text-amber-200/90",
      pct: "text-amber-700 dark:text-amber-300",
      badge: "bg-amber-500/20 text-amber-900 dark:bg-amber-500/25 dark:text-amber-200",
      pointsLabel: "text-gray-700 dark:text-amber-200/80",
      pointsValue: "text-gray-900 dark:text-amber-50",
    }
  }
  return {
    shell:
      "border-rose-300 bg-gradient-to-br from-rose-50 to-red-50/80 shadow-md ring-1 ring-rose-200/80 dark:border-rose-700/60 dark:from-rose-950/45 dark:to-red-950/30 dark:ring-rose-800/40",
    title: "text-gray-800 dark:text-rose-50",
    meta: "text-gray-700 dark:text-rose-200/90",
    pct: "text-rose-700 dark:text-rose-300",
    badge: "bg-rose-500/20 text-rose-800 dark:bg-rose-500/25 dark:text-rose-200",
    pointsLabel: "text-gray-700 dark:text-rose-200/80",
    pointsValue: "text-gray-900 dark:text-rose-50",
  }
}

export type ResultsKpiAccent = {
  fill: string
  ink: string
  labelClass: string
  iconWell: string
}

/** Map KPI index → chrome swatch stop (Accuracy=accent, Points=mid, Time=soft). */
export function resultsKpiAccent(
  index: number,
  swatch: ChromeSwatch,
  isDark: boolean,
): ResultsKpiAccent {
  const [soft, mid, accent, deep] = swatch
  const fill = index === 0 ? accent : index === 1 ? mid : soft
  const ink = index === 0 ? "#FFFFFF" : isDark ? "#FFFFFF" : deep
  const labelClass =
    index === 0
      ? "text-[var(--cc-accent-dark)] dark:text-[var(--cc-accent)]"
      : index === 1
        ? "text-amber-800 dark:text-amber-300"
        : "text-sky-800 dark:text-sky-300"
  return {
    fill,
    ink,
    labelClass,
    iconWell: fill,
  }
}

/** Shared CTA interaction classes for results action buttons. */
export const RESULTS_ACTION_BTN = cn(
  "relative overflow-hidden transition-[transform,box-shadow,background-color] duration-300 ease-out",
  "hover:-translate-y-0.5 hover:scale-[1.02] hover:shadow-md",
  "active:translate-y-0 active:scale-[0.98]",
)

export const RESULTS_SECTION_INTERACTIVE = cn(
  "border cursor-pointer transition-all duration-300",
  "hover:-translate-y-0.5 hover:shadow-lg hover:scale-[1.02]",
  "active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--cc-accent)]",
)

/** Theme-accent chrome — replaces hardcoded purple/indigo on student results. */
export const RESULTS_ACCENT_TITLE =
  "text-[var(--cc-accent-dark)] dark:text-[var(--cc-accent)]"

export const RESULTS_ACCENT_CTA = cn(
  "bg-[var(--cc-accent)] text-white shadow-lg",
  "hover:bg-[var(--cc-accent-hover)] hover:shadow-xl",
)

export const RESULTS_ACCENT_SOFT_PILL = cn(
  "border border-[var(--cc-accent-border)] bg-[var(--cc-accent-soft)]",
  "text-[var(--cc-accent-dark)] dark:text-[var(--cc-accent)]",
)

export const RESULTS_ACCENT_SECTION_HEADER =
  "bg-[var(--cc-accent-soft)] border border-[var(--cc-accent-border)]"

export const RESULTS_ACCENT_SECTION_HEADER_ACTIVE = cn(
  "bg-[var(--cc-accent-soft-strong)] border border-[var(--cc-accent)]",
  "ring-2 ring-[var(--cc-accent-border)]",
)

export const RESULTS_ACCENT_SECTION_TEXT =
  "font-semibold text-[var(--cc-accent-dark)] dark:text-[var(--cc-accent)]"

export const RESULTS_ACCENT_SECTION_META =
  "font-normal text-[var(--cc-accent-dark)]/80 dark:text-[var(--cc-accent)]/80 ml-1"

export const RESULTS_ACCENT_PTS_BADGE = cn(
  "flex items-center gap-2 rounded-full border border-[var(--cc-accent-border)]",
  "bg-[var(--cc-accent-soft)] px-3 py-1.5",
)

export const RESULTS_ACCENT_PTS_ICON = "text-[var(--cc-accent-dark)] dark:text-[var(--cc-accent)]"
export const RESULTS_ACCENT_PTS_TEXT =
  "text-sm font-bold text-[var(--cc-accent-dark)] dark:text-[var(--cc-accent)]"
export const RESULTS_ACCENT_PTS_SUB =
  "text-xs text-[var(--cc-accent-dark)]/70 dark:text-[var(--cc-accent)]/70"

export const RESULTS_ACCENT_QUESTION_HIGHLIGHT = cn(
  "border-[var(--cc-accent)] ring-2 ring-[var(--cc-accent-border)]",
  "bg-white dark:bg-slate-800",
)

export const RESULTS_ACCENT_ATTEMPT_SELECTED = cn(
  "border-[var(--cc-accent)] bg-[var(--cc-accent)] text-white",
  "shadow-[0_8px_25px_color-mix(in_srgb,var(--cc-accent)_35%,transparent)]",
  "ring-2 ring-[var(--cc-accent-border)]",
)
