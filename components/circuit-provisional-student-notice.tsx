"use client"

import { Info } from "lucide-react"
import { ClassroomProvisionalScoreBadge } from "@/components/classroom-provisional-score-badge"
import { CIRCUIT_PROVISIONAL_STUDENT_REASSURANCE } from "@/lib/circuit-submission"
import { cn } from "@/lib/utils"

type CircuitProvisionalStudentNoticeProps = {
  previewScore?: number | null
  maxPoints?: number
  className?: string
  compact?: boolean
}

export function CircuitProvisionalStudentNotice({
  previewScore,
  maxPoints,
  className,
  compact = false,
}: CircuitProvisionalStudentNoticeProps) {
  const max = Number(maxPoints) || 10
  const showScore =
    previewScore != null && Number.isFinite(Number(previewScore)) && Number(previewScore) >= 0

  return (
    <div
      className={cn(
        "rounded-xl border border-amber-300/80 dark:border-amber-700/80 bg-amber-50/90 dark:bg-amber-950/30",
        compact ? "p-3 space-y-2" : "p-4 space-y-3",
        className,
      )}
      role="status"
    >
      <div className="flex flex-wrap items-center gap-2">
        <ClassroomProvisionalScoreBadge compact={compact} />
        {showScore ? (
          <span className="text-sm font-semibold text-amber-900 dark:text-amber-100">
            Preview: {Number(previewScore).toFixed(1)}/{max} pts
          </span>
        ) : null}
      </div>
      <p
        className={cn(
          "text-amber-900/90 dark:text-amber-100/90 leading-relaxed flex gap-2",
          compact ? "text-xs" : "text-sm",
        )}
      >
        <Info className={cn("shrink-0 text-amber-700 dark:text-amber-300", compact ? "h-3.5 w-3.5 mt-0.5" : "h-4 w-4 mt-0.5")} />
        <span>{CIRCUIT_PROVISIONAL_STUDENT_REASSURANCE}</span>
      </p>
    </div>
  )
}
