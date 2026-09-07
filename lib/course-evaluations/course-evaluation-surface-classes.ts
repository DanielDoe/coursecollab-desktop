import { cn } from "@/lib/utils"
import {
  PORTAL_CARD,
  PORTAL_TEXT,
  PORTAL_TEXT_MUTED,
} from "@/lib/appearance/portal-nav-classes"

export const CE_TILE = cn(PORTAL_CARD, "shadow-none")

export const CE_PANEL = cn(CE_TILE, "p-3 sm:p-4")

export const CE_ROW = cn(
  "flex items-stretch gap-2 sm:gap-3 px-3 py-2.5 transition-colors hover:bg-muted/40",
)

export const CE_LABEL = cn("text-xs font-semibold uppercase tracking-wide", PORTAL_TEXT_MUTED)

export const CE_STATUS_PILL =
  "inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"

export function ceStatusPillClass(status: string): string {
  if (status === "pending") {
    return cn(CE_STATUS_PILL, "bg-[var(--cc-sem-warning)]/10 text-[var(--cc-sem-warning)]")
  }
  if (status === "approved") {
    return cn(CE_STATUS_PILL, "bg-[var(--cc-sem-success)]/10 text-[var(--cc-sem-success)]")
  }
  return cn(CE_STATUS_PILL, "bg-muted text-[var(--cc-text-muted)]")
}

export function ceChartFill(index: number): string {
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

export { PORTAL_CARD, PORTAL_TEXT, PORTAL_TEXT_MUTED }
