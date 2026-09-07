"use client"

import type { LucideIcon } from "lucide-react"
import { CheckCircle2, Layers, Lock } from "lucide-react"
import { cn } from "@/lib/utils"
import type { SolidListThumb } from "@/lib/student-color-hunt-theme"

type PracticeTopicCardProps = {
  name: string
  progressLabel: string
  accuracy: number
  completed: number
  unlocked: number
  thumb: SolidListThumb
  viewMode: "card" | "list"
  isSelected: boolean
  locked: boolean
  onClick: () => void
}

function progressFillColor(thumb: SolidListThumb, locked: boolean, isSelected: boolean) {
  if (locked) return "var(--cc-text-muted)"
  if (isSelected) return "var(--cc-accent)"
  return thumb.fill
}

function PracticeTopicBadge({
  icon: Icon,
  tone,
  compact,
}: {
  icon: LucideIcon
  tone: "practice" | "done" | "locked"
  compact?: boolean
}) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full border",
        compact ? "size-7" : "size-8",
        tone === "practice" &&
          "border-[color-mix(in_srgb,var(--cc-accent)_22%,transparent)] bg-[var(--cc-accent-soft)]/40 text-[var(--cc-accent-dark)]",
        tone === "done" &&
          "border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
        tone === "locked" &&
          "border-[color-mix(in_srgb,var(--cc-text)_12%,transparent)] bg-[var(--muted)]/50 text-[var(--cc-text-muted)]",
      )}
      aria-hidden
    >
      <Icon className={cn(compact ? "h-3.5 w-3.5" : "h-4 w-4")} strokeWidth={2} />
    </span>
  )
}

/** Uiverse-style progress card — https://uiverse.io/Cybercom682/ordinary-duck-36 */
export function PracticeTopicCard({
  name,
  progressLabel,
  accuracy,
  completed,
  unlocked,
  thumb,
  viewMode,
  isSelected,
  locked,
  onClick,
}: PracticeTopicCardProps) {
  const progressPct = Math.min(100, (completed / Math.max(1, unlocked)) * 100)
  const fill = progressFillColor(thumb, locked, isSelected)
  const poolComplete = unlocked > 0 && completed >= unlocked
  const compact = viewMode === "list"

  const badgeTone = locked ? "locked" : poolComplete ? "done" : "practice"
  const BadgeIcon = locked ? Lock : poolComplete ? CheckCircle2 : Layers

  const shellClass = cn(
    "w-full overflow-hidden rounded-lg border text-left shadow-md transition-[box-shadow,ring-color,border-color] duration-150",
    "border-[color-mix(in_srgb,var(--cc-text)_12%,transparent)] bg-[var(--card)]",
    "dark:border-[#333333] dark:bg-[#181818]",
    locked ? "cursor-not-allowed opacity-80" : "cursor-pointer hover:border-[color-mix(in_srgb,var(--cc-accent)_25%,transparent)] hover:shadow-lg",
    isSelected && "border-[color-mix(in_srgb,var(--cc-accent)_40%,transparent)] ring-2 ring-[var(--cc-accent)]/35",
  )

  const headerClass = cn(
    "flex items-center justify-between gap-3 border-b border-[color-mix(in_srgb,var(--cc-text)_8%,transparent)]",
    compact ? "px-4 py-2.5" : "px-5 py-3",
  )

  const bodyClass = compact ? "px-4 py-4" : "px-5 py-4"

  return (
    <button type="button" onClick={onClick} disabled={locked} className={shellClass}>
      <div className={headerClass}>
        <h3
          className={cn(
            "min-w-0 flex-1 truncate font-semibold text-[var(--cc-text)]",
            compact ? "text-base" : "text-lg",
          )}
        >
          {name}
        </h3>
        <PracticeTopicBadge icon={BadgeIcon} tone={badgeTone} compact={compact} />
      </div>
      <div className={bodyClass}>
        <p className="mb-3 text-sm font-medium text-[var(--cc-text-secondary)]">
          {progressLabel}
          <span className="text-[var(--cc-text-muted)]"> · </span>
          <span className="text-[var(--cc-text)]">{accuracy.toFixed(0)}% accuracy</span>
        </p>
        <div
          className="h-2.5 w-full overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--cc-text)_14%,transparent)] dark:bg-[#3a3a3a]"
          role="progressbar"
          aria-valuenow={Math.round(progressPct)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-2.5 min-w-[0px] rounded-full transition-[width] duration-300"
            style={{
              width: `${progressPct > 0 ? Math.max(progressPct, 6) : 0}%`,
              backgroundColor: locked ? "var(--cc-text-muted)" : isSelected ? "var(--cc-accent)" : fill,
            }}
          />
        </div>
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="text-sm text-[var(--cc-text-secondary)]">
            <span className="font-semibold text-[var(--cc-text)]">{progressPct.toFixed(0)}% complete</span>
            <span className="text-[var(--cc-text-muted)]"> · </span>
            {completed}/{unlocked} practiced
          </span>
          <span
            className={cn(
              "shrink-0 text-xs font-semibold",
              locked
                ? "text-[var(--cc-text-muted)]"
                : isSelected
                  ? "text-[var(--cc-accent-dark)]"
                  : "text-[var(--cc-accent)] hover:underline",
            )}
          >
            {locked ? "Upgrade" : isSelected ? "Selected" : "Select"}
          </span>
        </div>
      </div>
    </button>
  )
}
