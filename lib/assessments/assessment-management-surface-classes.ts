import { cn } from "@/lib/utils"
import {
  PORTAL_CARD,
  PORTAL_CTA,
  PORTAL_LIST_ROW_HOVER,
  PORTAL_TEXT,
  PORTAL_TEXT_MUTED,
} from "@/lib/appearance/portal-nav-classes"

export const AM_TILE = cn(PORTAL_CARD, "shadow-none")

export const AM_PANEL = cn(AM_TILE, "p-4 sm:p-5")

export const AM_ROW = cn(
  "flex items-start justify-between gap-3 px-3 py-2.5 transition-colors",
  PORTAL_LIST_ROW_HOVER,
)

export const AM_LIST_ROW = cn(
  "flex flex-col gap-3 px-3 py-3 transition-colors sm:flex-row sm:items-center sm:justify-between sm:px-4",
  PORTAL_LIST_ROW_HOVER,
)

export const AM_STAT_BOX = cn(
  "flex items-center gap-3 rounded-xl border border-[var(--border)] bg-muted/30 px-3 py-2.5",
)

export const AM_STATUS_PILL =
  "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"

export const AM_EMPTY = cn(AM_PANEL, "py-10 text-center")

export const AM_CHART_PANEL = cn(AM_TILE, "overflow-hidden p-0")

export const AM_CHART_BODY = "p-3 sm:p-4"

export const AM_CHART_TITLE = cn("text-xs font-semibold uppercase tracking-wide", PORTAL_TEXT)

export const AM_CHART_GRID_STROKE = "var(--border)"

export const AM_CHART_TICK = { fill: "var(--cc-text-muted)", fontSize: 11 } as const

export const AM_CHART_TOOLTIP = {
  borderRadius: 10,
  border: "1px solid var(--border)",
  background: "var(--card)",
  color: "var(--cc-text)",
  fontSize: 12,
} as const

export function amChartFill(index: number): string {
  const palette = [
    "var(--cc-accent)",
    "var(--cc-sem-info)",
    "var(--cc-sem-success)",
    "var(--cc-sem-warning)",
    "var(--cc-sem-danger)",
    "var(--cc-accent-dark)",
  ]
  return palette[index % palette.length]
}

export function amAccuracyPillClass(accuracy: number): string {
  if (accuracy >= 80) {
    return cn(AM_STATUS_PILL, "bg-[var(--cc-sem-success)]/10 text-[var(--cc-sem-success)]")
  }
  if (accuracy >= 50) {
    return cn(AM_STATUS_PILL, "bg-[var(--cc-sem-warning)]/10 text-[var(--cc-sem-warning)]")
  }
  return cn(AM_STATUS_PILL, "bg-[var(--cc-sem-danger)]/10 text-[var(--cc-sem-danger)]")
}

export function amDifficultyPillClass(difficulty: string): string {
  if (difficulty === "easy") {
    return cn(AM_STATUS_PILL, "bg-[var(--cc-sem-success)]/10 text-[var(--cc-sem-success)]")
  }
  if (difficulty === "hard" || difficulty === "very_hard") {
    return cn(AM_STATUS_PILL, "bg-[var(--cc-sem-danger)]/10 text-[var(--cc-sem-danger)]")
  }
  return cn(AM_STATUS_PILL, "bg-[var(--cc-sem-warning)]/10 text-[var(--cc-sem-warning)]")
}

export { PORTAL_CARD, PORTAL_CTA, PORTAL_LIST_ROW_HOVER, PORTAL_TEXT, PORTAL_TEXT_MUTED }
