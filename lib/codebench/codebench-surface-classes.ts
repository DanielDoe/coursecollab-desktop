import { cn } from "@/lib/utils"

/** Primary CodeBench card — lavender-tinted in dark mode, not flat gray. */
export const CODEBENCH_PANEL = cn(
  "rounded-xl border border-[color-mix(in_srgb,var(--cc-text)_8%,transparent)] bg-[var(--card)]",
  "shadow-[0_1px_2px_rgba(15,23,42,0.05),0_8px_22px_rgba(15,23,42,0.07)]",
  "dark:border-[color-mix(in_srgb,var(--cc-accent)_14%,var(--border))]",
  "dark:bg-[color-mix(in_srgb,var(--card)_84%,var(--cc-accent)_16%)]",
  "dark:shadow-[0_1px_0_color-mix(in_srgb,var(--cc-accent)_10%,transparent)_inset,0_8px_24px_rgba(0,0,0,0.35)]",
)

/** Nested block inside a CodeBench panel (stats, clang note, goal). */
export const CODEBENCH_INSET = cn(
  "rounded-xl border border-[color-mix(in_srgb,var(--cc-accent)_12%,var(--border))]",
  "bg-[color-mix(in_srgb,var(--cc-accent-soft)_30%,var(--card))]",
  "dark:bg-[color-mix(in_srgb,var(--card)_88%,var(--cc-accent)_12%)]",
)

/** Compact stat cell in workshop / analytics rows. */
export const CODEBENCH_STAT = cn(CODEBENCH_INSET, "rounded-lg px-2.5 py-2")

/** Meta chip (XP, time hints). */
export const CODEBENCH_CHIP = cn(
  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
  "bg-[color-mix(in_srgb,var(--cc-accent-soft)_40%,var(--card))] text-[var(--cc-text-muted)]",
  "dark:bg-[color-mix(in_srgb,var(--cc-accent)_10%,var(--card))]",
)

/** Section header wash — use instead of raw theme `soft` in dark mode. */
export const CODEBENCH_HEADER_WASH = cn(
  "border-b border-[color-mix(in_srgb,var(--cc-accent)_10%,var(--border))]",
  "bg-[color-mix(in_srgb,var(--cc-accent-soft)_35%,var(--card))]",
  "dark:bg-[color-mix(in_srgb,var(--card)_86%,var(--cc-accent)_14%)]",
)
