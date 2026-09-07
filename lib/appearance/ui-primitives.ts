/**
 * Themed class recipes for shared UI primitives.
 * Uses --cc-ui-* (structural) + --cc-sem-* (semantic accent) CSS variables.
 */

import type { SemanticRole } from "@/lib/appearance/semantic-tokens"
import { SEM_SPINNER } from "@/lib/appearance/semantic-class-maps"

/** Shared field control chrome (input, select, textarea) */
export const CC_FIELD = {
  base:
    "bg-[var(--cc-ui-surface,var(--card))] text-[var(--cc-text)] border-[var(--cc-ui-border,var(--border))] placeholder:text-[var(--cc-text-muted)]",
  focus:
    "focus-visible:border-[var(--cc-ui-focus-border,var(--cc-sem-primary))] focus-visible:ring-[var(--cc-ui-focus-glow,var(--cc-sem-primary-glow))] focus-visible:ring-[3px]",
  invalid:
    "aria-invalid:border-[var(--cc-sem-danger)] aria-invalid:ring-[var(--cc-sem-danger-glow)] aria-invalid:ring-[3px]",
  disabled: "disabled:bg-[var(--cc-ui-surface-muted,var(--muted))] disabled:opacity-50 disabled:cursor-not-allowed",
} as const

export const CC_OVERLAY_SURFACE =
  "bg-[var(--cc-ui-overlay-surface,var(--popover))] text-[var(--cc-text)] border border-[var(--cc-ui-border,var(--border))] shadow-md"

export const CC_MODAL_TITLE = "text-[var(--cc-text)] font-semibold"
export const CC_MODAL_DESCRIPTION = "text-[var(--cc-text-muted)] text-sm"

export const CC_TABLE = {
  head: "text-[var(--cc-text-secondary)] font-medium h-10 px-2",
  row: "border-b border-[var(--cc-ui-border,var(--border))] transition-colors hover:bg-[var(--cc-ui-table-row-hover,var(--muted))]",
  rowSelected: "data-[state=selected]:bg-[var(--cc-ui-table-row-selected,var(--cc-accent-soft))]",
  footer: "bg-[var(--cc-ui-table-header,var(--muted))]/50 border-t font-medium",
  caption: "text-[var(--cc-text-muted)] mt-4 text-sm",
} as const

export const CC_TABS = {
  list: "bg-[var(--cc-ui-tabs-list-bg,var(--muted))] text-[var(--cc-text-muted)] rounded-lg p-[3px]",
  trigger:
    "text-[var(--cc-text-secondary)] data-[state=active]:bg-[var(--cc-ui-tabs-active-bg,var(--card))] data-[state=active]:text-[var(--cc-ui-tabs-active-text,var(--cc-sem-primary-text))] data-[state=active]:shadow-sm data-[state=active]:border-[var(--cc-ui-border,var(--border))]",
} as const

export const CC_PROGRESS = {
  track: "bg-[var(--cc-ui-progress-track,var(--muted))] h-2 rounded-full overflow-hidden",
  fill: "bg-[var(--cc-ui-progress-fill,var(--cc-sem-primary))] h-full transition-all",
} as const

export const CC_SKELETON = "bg-[var(--cc-ui-skeleton,var(--muted))] animate-pulse rounded-md"

export const CC_CARD =
  "bg-[var(--cc-ui-surface,var(--card))] text-[var(--cc-text)] border border-[var(--cc-ui-border,var(--border))] shadow-sm"

export const CC_SPINNER_ICON = "text-[var(--cc-ui-spinner-active,var(--cc-sem-primary))] animate-spin"

export function ccSpinnerRingClass(role: SemanticRole = "primary"): string {
  return [
    "animate-spin rounded-full border-2",
    "border-[var(--cc-ui-spinner-track,var(--border))]",
    SEM_SPINNER[role],
  ].join(" ")
}

/** Default page loading ring — respects module semantic when enabled */
export function ccPageSpinnerClass(moduleRole: SemanticRole = "primary"): string {
  return ccSpinnerRingClass(moduleRole)
}

export const CC_CALENDAR = {
  root: "bg-[var(--cc-ui-surface,var(--card))] text-[var(--cc-text)]",
  weekday: "text-[var(--cc-text-muted)]",
  today: "bg-[var(--cc-ui-calendar-today-bg,var(--cc-sem-calendar-soft))] text-[var(--cc-text)] rounded-md",
  selected:
    "data-[selected-single=true]:bg-[var(--cc-ui-calendar-selected,var(--cc-sem-calendar))] data-[selected-single=true]:text-white",
  range:
    "data-[range-start=true]:bg-[var(--cc-ui-calendar-selected,var(--cc-sem-calendar))] data-[range-end=true]:bg-[var(--cc-ui-calendar-selected,var(--cc-sem-calendar))] data-[range-middle=true]:bg-[var(--cc-ui-calendar-today-bg,var(--cc-sem-calendar-soft))]",
  outside: "text-[var(--cc-text-muted)] opacity-60",
} as const

export const CC_ALERT = {
  default: "bg-[var(--cc-ui-surface,var(--card))] text-[var(--cc-text)] border-[var(--cc-ui-border,var(--border))]",
  success:
    "bg-[var(--cc-sem-success-soft)] text-[var(--cc-sem-success-text)] border-[var(--cc-sem-success-border)]",
  warning:
    "bg-[var(--cc-sem-warning-soft)] text-[var(--cc-sem-warning-text)] border-[var(--cc-sem-warning-border)]",
  danger:
    "bg-[var(--cc-sem-danger-soft)] text-[var(--cc-sem-danger-text)] border-[var(--cc-sem-danger-border)]",
  info: "bg-[var(--cc-sem-info-soft)] text-[var(--cc-sem-info-text)] border-[var(--cc-sem-info-border)]",
} as const

export const CC_TOOLTIP =
  "bg-[var(--cc-ui-overlay-surface,var(--popover))] text-[var(--cc-text)] border border-[var(--cc-ui-border,var(--border))] shadow-md"

export const CC_COMMAND = {
  root:
    "bg-[var(--cc-ui-overlay-surface,var(--popover))] text-[var(--cc-text)] flex h-full w-full flex-col overflow-hidden rounded-xl",
  inputWrapper:
    "flex h-10 items-center gap-2 border-b border-[var(--cc-ui-border,var(--border))] px-3",
  input:
    "placeholder:text-[var(--cc-text-muted)] flex h-10 w-full rounded-md bg-transparent py-3 text-sm text-[var(--cc-text)] outline-hidden disabled:cursor-not-allowed disabled:opacity-50",
  list: "max-h-[300px] scroll-py-1 overflow-x-hidden overflow-y-auto",
  empty: "py-6 text-center text-sm text-[var(--cc-text-muted)]",
  group:
    "overflow-hidden p-1 text-[var(--cc-text)] [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-[var(--cc-text-muted)]",
  item:
    "relative flex cursor-default select-none items-center gap-2 rounded-lg px-2 py-2 text-sm text-[var(--cc-text)] outline-hidden data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 data-[selected=true]:bg-[var(--cc-accent-soft)] data-[selected=true]:text-[var(--cc-accent-dark)] [&_svg:not([class*='text-'])]:text-[var(--cc-text-muted)] [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  shortcut: "ml-auto text-xs tracking-widest text-[var(--cc-text-muted)]",
  separator: "bg-[var(--cc-ui-border,var(--border))] -mx-1 h-px",
} as const

/** Radix select dropdown — portal text + accent highlight */
export const CC_SELECT = {
  label: "px-2 py-1.5 text-xs text-[var(--cc-text-muted)]",
  item:
    "relative flex w-full cursor-default select-none items-center gap-2 rounded-lg py-1.5 pr-8 pl-2 text-sm text-[var(--cc-text)] outline-hidden data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 focus:bg-[var(--cc-accent-soft)] focus:text-[var(--cc-accent-dark)] data-[highlighted]:bg-[var(--cc-accent-soft)] data-[highlighted]:text-[var(--cc-accent-dark)] [&_svg:not([class*='text-'])]:text-[var(--cc-text-muted)] [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2",
  separator: "bg-[var(--cc-ui-border,var(--border))] pointer-events-none -mx-1 my-1 h-px",
} as const
