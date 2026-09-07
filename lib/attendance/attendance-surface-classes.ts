import { cn } from "@/lib/utils"
import {
  PORTAL_CARD,
  PORTAL_CTA,
  PORTAL_TEXT,
  PORTAL_TEXT_MUTED,
} from "@/lib/appearance/portal-nav-classes"

export const ATTENDANCE_TILE = cn(PORTAL_CARD, "shadow-none")

export const ATTENDANCE_TILE_COMPACT = cn(
  "rounded-xl border border-[var(--border)] bg-[var(--card)] p-3.5",
)

export const ATTENDANCE_LABEL = cn(
  "text-xs font-semibold uppercase tracking-wide",
  PORTAL_TEXT_MUTED,
)

export const ATTENDANCE_INPUT = cn(
  "rounded-lg border-[var(--border)] bg-[var(--card)] shadow-none text-[var(--cc-text)] placeholder:text-[var(--cc-text-secondary)] data-[placeholder]:text-[var(--cc-text-secondary)]",
)

export const ATTENDANCE_TABLE_HEAD = cn(
  "bg-muted/50 border-b border-[var(--border)] text-[var(--cc-text-secondary)]",
)

export const ATTENDANCE_TABLE_ROW = cn(
  "border-b border-[var(--border)]/60 hover:bg-muted/40",
)

export { PORTAL_CARD, PORTAL_CTA, PORTAL_TEXT, PORTAL_TEXT_MUTED }
