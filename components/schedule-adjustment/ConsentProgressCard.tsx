"use client"

import { cn } from "@/lib/utils"
import type { ConsentProgressSummary } from "@/lib/schedule-adjustment/validate"

export function ConsentProgressCard({
  stats,
  requestStatus,
  className,
}: {
  stats: ConsentProgressSummary
  requestStatus?: string | null
  className?: string
}) {
  const majority = stats.thresholdPercent <= 50
  const thresholdLabel = majority
    ? "more than half the class"
    : `the ${stats.thresholdPercent}% requirement`
  const finalized = requestStatus === "FINALIZED" || requestStatus === "COMPLETED"
  const awaitingFinalize =
    requestStatus === "CONSENT_COMPLETE" ||
    requestStatus === "READY_TO_FINALIZE" ||
    (stats.thresholdMet && requestStatus === "COLLECTING_CONSENT")

  if (finalized) {
    return (
      <div
        className={cn(
          "rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-3 sm:px-4",
          className,
        )}
      >
        <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">Schedule change complete</p>
        <p className="mt-1 text-xs text-[var(--cc-text-muted)]">
          {stats.agreed} of {stats.total} students consented. Calendars are updated for the section.
        </p>
      </div>
    )
  }

  if (awaitingFinalize) {
    return (
      <div
        className={cn(
          "rounded-xl border border-[color-mix(in_srgb,var(--cc-accent)_35%,var(--border))]",
          "bg-[color-mix(in_srgb,var(--cc-accent)_8%,var(--card))] px-3 py-3 sm:px-4",
          className,
        )}
      >
        <p className="text-sm font-semibold text-[var(--cc-text)]">Consent threshold reached</p>
        <p className="mt-1 text-xs text-[var(--cc-text-muted)]">
          {stats.agreed} of {stats.total} students ({stats.percentOfClass}%) have consented — meeting{" "}
          {thresholdLabel}. Waiting for the instructor to finalize so everyone&apos;s calendar updates together.
        </p>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "rounded-xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--muted)_40%,var(--card))] px-3 py-3 sm:px-4",
        className,
      )}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-[var(--cc-text)]">Class consent progress</p>
        <p className="text-xs font-medium text-[var(--cc-accent-dark)]">
          {stats.percentTowardThreshold}% toward finalize
        </p>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--muted)]">
        <div
          className="h-full rounded-full bg-[var(--cc-accent)] transition-all"
          style={{ width: `${stats.percentTowardThreshold}%` }}
        />
      </div>
      <p className="mt-2 text-xs leading-relaxed text-[var(--cc-text-muted)]">
        <span className="font-medium text-[var(--cc-text)]">
          {stats.agreed} of {stats.required}
        </span>{" "}
        consents needed ({majority ? `more than half of ${stats.total} enrolled` : `${stats.thresholdPercent}% of ${stats.total} enrolled`}) ·{" "}
        <span className="font-medium text-[var(--cc-text)]">{stats.remaining} more</span> until the instructor can
        finalize and update calendars for everyone.
        {stats.declined > 0 ? (
          <> · {stats.declined} concern{stats.declined === 1 ? "" : "s"} recorded (must be resolved).</>
        ) : null}
      </p>
    </div>
  )
}
