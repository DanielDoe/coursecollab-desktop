"use client"

import type { StudentRecommendationJourney } from "@/lib/recommendation-student-journey"
import { toneToBadgeShellClass } from "@/lib/recommendation-student-journey"
import { cn } from "@/lib/utils"

export function RecommendationStudentJourneyBadge({
  journey,
  compact = false,
  className,
}: {
  journey: StudentRecommendationJourney
  compact?: boolean
  className?: string
}) {
  const shell = toneToBadgeShellClass(journey.tone)

  if (compact) {
    return (
      <div
        className={cn(
          "inline-flex max-w-[min(100%,16rem)] flex-col gap-1 rounded-xl border px-2.5 py-2 shadow-sm",
          shell,
          className,
        )}
        aria-label={journey.ariaLabel}
      >
        <div className="flex items-start justify-between gap-2 gap-y-1">
          <span className="text-[10px] font-bold tabular-nums text-black/65 dark:text-white/65">
            {journey.step > 0 ? (
              <>
                Step {Math.min(journey.step, journey.total)}/{journey.total}
              </>
            ) : (
              <span className="text-red-950/90 dark:text-red-100/90">—</span>
            )}
          </span>
          <span className="text-[9px] font-semibold uppercase tracking-wide opacity-95 text-right">{journey.pillar}</span>
        </div>
        <p className="text-[11px] sm:text-xs font-semibold leading-snug text-balance">{journey.headline}</p>
        <p className="text-[9px] sm:text-[10px] opacity-92 leading-snug text-balance">{journey.subline}</p>
        <div
          className="select-none text-[8px] sm:text-[9px] font-mono leading-none tracking-[0.12em] text-black/55 dark:text-white/55 break-all"
          aria-hidden
        >
          {journey.runway}
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "inline-flex flex-col gap-2 rounded-2xl border px-3.5 py-3 shadow-md shadow-black/[0.07] dark:shadow-black/50 max-w-xl",
        shell,
        className,
      )}
      role="region"
      aria-label={journey.ariaLabel}
    >
      <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em]">{journey.pillar}</p>
        <span className="text-xs font-bold tabular-nums opacity-95">
          Step {Math.min(journey.step, journey.total)} of {journey.total}
        </span>
      </div>
      <p className="text-base sm:text-lg font-bold tracking-tight text-balance">{journey.headline}</p>
      <p className="text-[12px] sm:text-sm opacity-92 leading-snug">{journey.subline}</p>
      <div className="pt-1 border-t border-black/10 dark:border-white/10">
        <p className="text-[10px] font-medium uppercase tracking-wider mb-1.5 opacity-70">Roadmap stripe</p>
        <div
          className="font-mono text-[10px] sm:text-xs tracking-[0.14em] text-black/60 dark:text-white/65 break-all select-none"
          aria-hidden
        >
          {journey.runway}
        </div>
        <p className="text-[10px] mt-2 opacity-80 leading-relaxed">
          Early steps cover queue & questionnaires; middle steps cover drafting; amber & rose stretches can loop while
          your instructor completes multiple approval passes before the PDF vault opens.
        </p>
      </div>
    </div>
  )
}
