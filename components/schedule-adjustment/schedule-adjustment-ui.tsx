import { cn } from "@/lib/utils"

export const scheduleFormLabel = "text-[var(--cc-text)]"
export const scheduleFormHelp = "text-[var(--cc-text-muted)]"
export const scheduleFormSelect =
  "mt-1 w-full rounded-md border px-3 py-2 text-sm bg-[var(--cc-ui-surface,var(--card))] text-[var(--cc-text)] border-[var(--cc-ui-border,var(--border))] focus-visible:border-[var(--cc-ui-focus-border,var(--cc-sem-primary))] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--cc-ui-focus-glow,var(--cc-sem-primary-glow))]"
export const scheduleFormSelectCompact = scheduleFormSelect.replace("mt-1 ", "")

export function scheduleChoiceCardClass(selected: boolean) {
  return cn(
    "rounded-xl border p-3 text-left text-sm transition-colors",
    "border-[var(--cc-ui-border,var(--border))] bg-[color-mix(in_srgb,var(--muted)_18%,var(--card))]",
    "text-[var(--cc-text)]",
    selected &&
      "border-[color-mix(in_srgb,var(--cc-accent)_42%,var(--border))] bg-[color-mix(in_srgb,var(--cc-accent)_12%,var(--card))] ring-1 ring-[color-mix(in_srgb,var(--cc-accent)_28%,transparent)]",
  )
}

export function scheduleDayPillClass(selected: boolean) {
  return cn(
    "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
    selected
      ? "border-[color-mix(in_srgb,var(--cc-accent)_40%,var(--border))] bg-[var(--cc-accent)] text-white"
      : "border-[var(--cc-ui-border,var(--border))] bg-[color-mix(in_srgb,var(--muted)_12%,var(--card))] text-[var(--cc-text-muted)] hover:bg-[color-mix(in_srgb,var(--muted)_28%,var(--card))] hover:text-[var(--cc-text)]",
  )
}

export function scheduleStatusBadgeClass(status: string) {
  const key = status.toUpperCase()
  if (key === "COMPLETED" || key === "FINALIZED") {
    return "bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/25 dark:text-emerald-300"
  }
  if (key === "CANCELLED" || key === "REJECTED") {
    return "bg-slate-500/15 text-slate-600 dark:bg-slate-400/20 dark:text-slate-300"
  }
  if (key === "DRAFT") {
    return "bg-violet-500/15 text-violet-700 dark:bg-violet-500/25 dark:text-violet-300"
  }
  if (key.includes("CONSENT") || key.includes("DEPARTMENT") || key.includes("FINALIZE")) {
    return "bg-amber-500/15 text-amber-800 dark:bg-amber-500/25 dark:text-amber-300"
  }
  return "bg-sky-500/15 text-sky-700 dark:bg-sky-500/25 dark:text-sky-300"
}

export function scheduleStatusLabel(status: string, mode?: string | null) {
  if (String(mode ?? "").toUpperCase() === "DIRECT_PROPOSAL" && status === "COLLECTING_CONSENT") {
    return "AWAITING STUDENT CONSENT"
  }
  if (status === "COLLECTING_CONSENT") return "AWAITING STUDENT CONSENT"
  return status.replace(/_/g, " ")
}

export function ScheduleStatusPill({
  status,
  adjustmentMode,
  className,
}: {
  status: string
  adjustmentMode?: string | null
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide",
        scheduleStatusBadgeClass(status),
        className,
      )}
    >
      {scheduleStatusLabel(status, adjustmentMode)}
    </span>
  )
}
