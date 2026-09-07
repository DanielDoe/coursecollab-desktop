import { cn } from "@/lib/utils"
import {
  PORTAL_CARD,
  PORTAL_CTA,
  PORTAL_TEXT,
  PORTAL_TEXT_MUTED,
} from "@/lib/appearance/portal-nav-classes"

export const CP_TILE = cn(PORTAL_CARD, "shadow-none")

export const CP_PANEL = cn(CP_TILE, "p-3 sm:p-4")

export const CP_ROW = cn(
  "flex items-start justify-between gap-3 px-3 py-2.5 transition-colors hover:bg-muted/40",
)

export const CP_ROW_INNER = cn(
  "rounded-xl border border-[var(--border)] bg-[var(--muted)]/40 p-3",
)

export const CP_LABEL = cn("text-xs font-semibold uppercase tracking-wide", PORTAL_TEXT_MUTED)

export const CP_ACTION =
  "h-7 w-7 text-[var(--cc-text)] hover:bg-muted/60"

export const CP_STATUS_PILL =
  "inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"

export { PORTAL_CARD, PORTAL_CTA, PORTAL_TEXT, PORTAL_TEXT_MUTED }
