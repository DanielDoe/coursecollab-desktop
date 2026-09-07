"use client"

import Link from "next/link"
import { ClipboardList, X } from "lucide-react"
import type { AssessmentPolicy } from "@/lib/assessment-policy-settings"
import { formatTimerMmSs } from "@/lib/assessment-timer"
import { useDismissibleBanner } from "@/lib/use-dismissible-banner"
import { cn } from "@/lib/utils"

type CourseAssessmentDefaultsBannerProps = {
  policy: AssessmentPolicy | null
  adminHref?: string
  /** Unique key so dismiss is per assessment (e.g. quiz id). */
  dismissKey?: string
  /** Auto-hide after this many ms (default 12s). Set 0 to disable. */
  autoDismissMs?: number
}

export function CourseAssessmentDefaultsBanner({
  policy,
  adminHref = "/faculty/dashboard/administration/assessment-defaults",
  dismissKey = "global",
  autoDismissMs = 12_000,
}: CourseAssessmentDefaultsBannerProps) {
  const storageKey = `course-assessment-defaults-banner-${dismissKey}`
  const { visible, dismiss } = useDismissibleBanner(storageKey, {
    autoDismissMs: autoDismissMs > 0 ? autoDismissMs : undefined,
  })

  if (!policy || !visible) return null

  const t = policy.timer
  const s = policy.sections
  const circuitPool = formatTimerMmSs(t.hybrid_circuit_section_pooled_seconds)

  return (
    <div
      className={cn(
        "relative rounded-xl border border-[var(--border)] bg-[var(--muted)]/25 px-4 py-3 pr-10 text-sm",
      )}
    >
      <div className="flex items-start gap-3">
        <ClipboardList className="mt-0.5 h-4 w-4 shrink-0 text-[var(--cc-accent)]" />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-[var(--cc-text)]">
            Course assessment defaults apply where this assessment does not override
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-[var(--cc-text-secondary)]">
            MCQ {t.objective_mcq_seconds}s · True/False {t.objective_true_false_seconds}s · Select All{" "}
            {t.objective_select_all_seconds}s · Hybrid Section II {circuitPool} · Circuit-only pool{" "}
            {formatTimerMmSs(t.circuit_only_seconds_per_question)} · Objective backtracking{" "}
            {s.objective_allow_backtracking ? "on" : "off"}
          </p>
          <Link
            href={adminHref}
            className="mt-2 inline-block text-xs font-medium text-[var(--cc-accent)] hover:underline"
          >
            Edit course defaults →
          </Link>
        </div>
      </div>
      <button
        type="button"
        onClick={dismiss}
        className="absolute right-2 top-2 rounded-md p-1 text-[var(--cc-text-muted)] hover:bg-[var(--muted)]/60 hover:text-[var(--cc-text)]"
        aria-label="Dismiss course defaults notice"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
