import { cn } from "@/lib/utils"
import { PORTAL_CARD, PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"

/** Flat syllabus tiles — no gradients; matches faculty/student portal surfaces. */
export const SYLLABUS_TILE = cn(
  PORTAL_CARD,
  "p-4 ring-1 ring-[var(--border)]/50 shadow-none",
)

export const SYLLABUS_TILE_COMPACT = cn(
  "rounded-xl bg-[var(--muted)] p-3.5 ring-1 ring-[var(--border)]/40",
)

export const SYLLABUS_PREVIEW_PANEL = cn(
  "mt-5 rounded-xl bg-[var(--muted)] p-4 ring-1 ring-[var(--border)]/40",
)

/** Inline markdown preview under rich-text fields — never force light `bg-background`. */
export const SYLLABUS_INLINE_PREVIEW = cn(
  "rounded-xl bg-[var(--muted)] p-4 ring-1 ring-[var(--border)]/40",
)

export const SYLLABUS_MARKDOWN_ROOT = cn(
  "syllabus-markdown max-w-none text-[var(--cc-text)]",
  "[&_p]:leading-relaxed [&_p]:text-[var(--cc-text-muted)]",
  "[&_li]:leading-relaxed [&_li]:text-[var(--cc-text-muted)]",
  "[&_strong]:text-[var(--cc-text)]",
  "[&_a]:break-all [&_a]:text-[var(--cc-accent-dark)] [&_a]:underline-offset-2 hover:[&_a]:underline",
  "[&_ul]:my-3 [&_ol]:my-3",
)

export const SYLLABUS_LABEL = cn("text-xs font-semibold uppercase tracking-wide", PORTAL_TEXT_MUTED)

export const SYLLABUS_VALUE = cn("text-sm leading-relaxed", PORTAL_TEXT)

export const SYLLABUS_VALUE_MUTED = cn("text-sm leading-relaxed", PORTAL_TEXT_MUTED)

export const SYLLABUS_DROPZONE = cn(
  "rounded-xl border-2 border-dashed p-5 text-center transition-colors",
  "border-[var(--cc-accent-border)] bg-[var(--cc-accent-soft)]/35",
)

export const SYLLABUS_DROPZONE_ACTIVE = "border-[var(--cc-accent)] bg-[var(--cc-accent-soft)]"

export { PORTAL_TEXT, PORTAL_TEXT_MUTED, PORTAL_CARD }
