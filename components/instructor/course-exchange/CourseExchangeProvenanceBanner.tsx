"use client"

import { GitBranch, ShieldCheck, X } from "lucide-react"
import {
  EXCHANGE_INDEPENDENT_COPY_NOTE,
  formatExchangeCopiedAt,
  formatExchangeSourceLine,
  type ExchangeProvenance,
} from "@/lib/course-exchange/provenance-shared"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { useDismissibleBanner } from "@/lib/use-dismissible-banner"
import { PORTAL_TEXT } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"

export function CourseExchangeProvenanceBanner({
  provenance,
  variant = "banner",
  moduleId = "course-exchange",
  cloneSummary,
  className,
  dismissId,
  autoDismissMs,
}: {
  provenance: ExchangeProvenance
  variant?: "banner" | "compact"
  moduleId?: string
  cloneSummary?: Record<string, unknown> | null
  className?: string
  dismissId?: string
  autoDismissMs?: number
}) {
  const chrome = facultyEmbedChrome(moduleId)
  const copiedLabel = formatExchangeCopiedAt(provenance.copiedAt)
  const storageKey =
    dismissId ?? `exchange-provenance:${provenance.requestId}:${provenance.sourceCourseCode}`
  const { visible, dismiss } = useDismissibleBanner(storageKey, {
    autoDismissMs: autoDismissMs !== undefined ? autoDismissMs : 12_000,
  })

  if (!visible) return null

  if (variant === "compact") {
    return (
      <div
        className={cn(
          "relative flex items-start gap-2.5 rounded-xl border border-[var(--border)] px-3 py-2.5 pr-9",
          "bg-[var(--muted)]/30",
          className,
        )}
      >
        <GitBranch className={cn("mt-0.5 h-4 w-4 shrink-0", chrome.p.iconText)} />
        <div className="min-w-0 text-xs leading-relaxed text-[var(--cc-text-secondary)]">
          <span className="font-medium text-[var(--cc-text)]">Course Exchange copy</span>
          {" · "}
          {formatExchangeSourceLine(provenance)}
          {copiedLabel ? ` · imported ${copiedLabel}` : ""}
          {" — "}
          {EXCHANGE_INDEPENDENT_COPY_NOTE}
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="absolute right-2 top-2 rounded-md p-1 text-[var(--cc-text-muted)] hover:bg-[var(--muted)]/60 hover:text-[var(--cc-text)]"
          aria-label="Dismiss lineage banner"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] pr-2",
        className,
      )}
    >
      <button
        type="button"
        onClick={dismiss}
        className="absolute right-2 top-2 z-10 rounded-md p-1 text-[var(--cc-text-muted)] hover:bg-[var(--muted)]/60 hover:text-[var(--cc-text)]"
        aria-label="Dismiss lineage banner"
      >
        <X className="h-3.5 w-3.5" />
      </button>
      <div className={cn("flex items-start gap-3 border-b border-[var(--border)] px-4 py-3 pr-8", chrome.p.softBg)}>
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
            chrome.p.iconBg,
            chrome.p.iconText,
          )}
        >
          <GitBranch className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className={cn("text-sm font-semibold", PORTAL_TEXT)}>Independent Course Exchange copy</p>
          <p className="mt-0.5 text-xs text-[var(--cc-text-secondary)]">
            Imported from {formatExchangeSourceLine(provenance)}
            {copiedLabel ? ` · ${copiedLabel}` : ""}
          </p>
        </div>
      </div>
      <div className="space-y-2 px-4 py-3">
        <div className="flex gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--muted)]/25 px-3 py-2.5">
          <ShieldCheck className={cn("mt-0.5 h-4 w-4 shrink-0", chrome.p.iconText)} />
          <p className="text-xs leading-relaxed text-[var(--cc-text-secondary)]">{EXCHANGE_INDEPENDENT_COPY_NOTE}</p>
        </div>
        {cloneSummary && Object.keys(cloneSummary).length > 0 ? (
          <p className="text-xs text-[var(--cc-text-muted)]">
            Your copy is fully separate in the database — new question, quiz, and lecture rows scoped to this course
            only.
          </p>
        ) : null}
      </div>
    </div>
  )
}
