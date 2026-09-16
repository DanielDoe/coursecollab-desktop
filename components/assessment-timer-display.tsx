"use client"

import { Clock } from "lucide-react"
import { formatTimerMmSs } from "@/lib/assessment-timer"

interface QuestionTimerProps {
  secondsRemaining: number
  totalSeconds: number
  starting?: boolean
  className?: string
}

/** Per-question countdown for strict objective sections. */
export function QuestionTimer({
  secondsRemaining,
  totalSeconds,
  starting = false,
  className = "",
}: QuestionTimerProps) {
  const urgent = secondsRemaining <= 10
  const progress = totalSeconds > 0 ? (secondsRemaining / totalSeconds) * 100 : 0

  return (
    <div className={className}>
      <div className="flex items-center justify-end gap-2 mb-2">
        <div
          className={`px-2.5 sm:px-3 py-1.5 rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-md flex items-center shrink-0 tabular-nums ${
            urgent
              ? "bg-red-100/80 dark:bg-red-900/80 text-red-700 dark:text-red-300 animate-pulse"
              : "bg-blue-100/80 dark:bg-blue-900/80 text-blue-700 dark:text-blue-300"
          }`}
        >
          <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1" />
          {starting ? "…" : `${secondsRemaining}s`}
        </div>
      </div>
      {totalSeconds > 0 && (
        <div className="space-y-2 sm:space-y-3">
          <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-200">Time Remaining</div>
          <div className="h-2 sm:h-2.5 bg-slate-200/80 dark:bg-slate-700/80 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-1000 ease-linear rounded-full ${
                urgent ? "bg-red-500" : "bg-blue-500"
              }`}
              style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

interface SectionTimerProps {
  secondsRemaining: number
  totalSeconds: number
  sectionTitle?: string
  /** When true, one pooled timer covers the whole assessment (finals). */
  examWide?: boolean
  starting?: boolean
  className?: string
}

/** Section-level pooled countdown for circuit / multi-part sections. */
export function SectionTimer({
  secondsRemaining,
  totalSeconds,
  sectionTitle,
  examWide = false,
  starting = false,
  className = "",
}: SectionTimerProps) {
  const urgent = secondsRemaining <= 120
  const progress = totalSeconds > 0 ? (secondsRemaining / totalSeconds) * 100 : 0

  const label = examWide
    ? "Exam time remaining — one pool for all sections"
    : sectionTitle
      ? `${sectionTitle} — section time`
      : "Section time remaining"

  return (
    <div className={className}>
      <div
        className={`flex items-center gap-2 mb-2 ${examWide ? "justify-between" : "justify-end"}`}
      >
        {examWide ? (
          <div className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-200 min-w-0">
            {label}
          </div>
        ) : null}
        <div
          className={`px-2.5 sm:px-3 py-1.5 rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-md flex items-center shrink-0 tabular-nums ${
            urgent
              ? "bg-amber-100/80 dark:bg-amber-900/80 text-amber-800 dark:text-amber-200 animate-pulse"
              : "bg-violet-100/80 dark:bg-violet-900/80 text-violet-800 dark:text-violet-200"
          }`}
        >
          <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1" />
          {starting ? "…" : formatTimerMmSs(secondsRemaining)}
        </div>
      </div>
      <div className="space-y-1 sm:space-y-2">
        {!examWide ? (
          <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-200">{label}</div>
        ) : null}
        <div className="h-2 sm:h-2.5 bg-slate-200/80 dark:bg-slate-700/80 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-1000 ease-linear rounded-full ${
              urgent ? "bg-amber-500" : "bg-violet-500"
            }`}
            style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
          />
        </div>
      </div>
    </div>
  )
}
