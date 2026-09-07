"use client"

import { Button } from "@/components/ui/button"
import { RefreshCw, Zap, Timer, Lock, FileBarChart, AlertCircle, Play } from "lucide-react"
import { cn } from "@/lib/utils"
import { PORTAL_CTA, PORTAL_OUTLINE_BTN } from "@/lib/appearance/portal-nav-classes"
import {
  materialSurfaceClass,
  useMaterialRipple,
} from "@/components/ui/material-interactive-surface"

export type ActionVariant = "start" | "report" | "retake" | "extend" | "locked"

interface AssessmentActionButtonsProps {
  /** Layout: "horizontal" for list view (buttons in one row), "stacked" for vertical */
  layout?: "horizontal" | "stacked"
  /** Align buttons to right (e.g. for card footers) */
  align?: "left" | "right"
  /** Compact for tighter spacing (list view) */
  compact?: boolean
  /** Assessment type label (e.g. "Quiz", "Exam") */
  assessmentLabel?: string
  /** Primary gradient for Start button */
  startGradient?: string
  /** Callbacks */
  onStart?: () => void
  onViewReport?: () => void
  onRetake?: () => void
  onContinue?: () => void
  onExtend?: () => void
  /** Extend button loading state */
  extending?: boolean
  /** Extend button label (e.g. "Extend 24h", "Extend (Upgrade)") */
  extendLabel?: string
  /** Which actions to show */
  show: {
    start?: boolean
    report?: boolean
    retake?: boolean
    continue?: boolean
    extend?: boolean
    locked?: boolean
    /** Overdue/closed state - red disabled */
    closed?: boolean
  }
  /** Disabled state for entire group */
  disabled?: boolean
  /** Full width on mobile */
  fullWidthMobile?: boolean
  /** Custom label for locked state (e.g. "Available in 2d 5h") */
  lockedLabel?: string
  /** Custom label for closed/overdue state */
  closedLabel?: string
  /** Overrides "Start {assessmentLabel}" (e.g. "Open homework" after calendar due when extension is active) */
  startLabel?: string
  /** When set, the locked control stays clickable (e.g. explain instructor allowlist). */
  onLockedInfo?: () => void
  /** Retake button styling — neutral uses slate tones for embedded dashboard cards */
  retakeAppearance?: "default" | "neutral"
}

const baseButtonClass = "font-semibold transition-all duration-200 active:scale-[0.98] touch-manipulation"

export function AssessmentActionButtons({
  layout = "horizontal",
  align = "left",
  compact = false,
  assessmentLabel = "Quiz",
  startGradient = "bg-teal-600 hover:bg-teal-700 text-white",
  onStart,
  onViewReport,
  onRetake,
  onContinue,
  onExtend,
  extending = false,
  extendLabel = "Extend",
  show,
  disabled = false,
  fullWidthMobile = true,
  lockedLabel,
  closedLabel = "Exam Closed",
  startLabel,
  onLockedInfo,
  retakeAppearance = "default",
}: AssessmentActionButtonsProps) {
  const spawnRipple = useMaterialRipple(disabled)
  const btnBase = fullWidthMobile ? "w-full sm:w-auto" : ""
  const minH = compact ? "min-h-[36px] sm:min-h-0 h-9 sm:h-8" : "min-h-[44px] sm:min-h-0 py-2.5 sm:py-3"
  const gap = layout === "stacked" ? "gap-2 sm:gap-3" : "gap-2"
  const flexDir = layout === "stacked" ? "flex-col" : "flex-row flex-nowrap"
  const alignClass = align === "right" ? "sm:ml-auto sm:justify-end" : ""

  return (
    <div className={cn("flex", flexDir, gap, "items-stretch sm:items-center", alignClass)}>
      {/* Continue - Primary when saved for later (resume in-progress attempt) */}
      {show.continue && onContinue && (
        <Button
          onClick={onContinue}
          disabled={disabled}
          variant="ghost"
          className={cn(
            baseButtonClass,
            btnBase,
            minH,
            "rounded-xl shadow-md hover:shadow-lg",
            PORTAL_CTA,
            "text-xs sm:text-sm px-4 sm:px-5",
            "flex items-center justify-center gap-2",
          )}
        >
          <Play className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
          <span className="sm:hidden">Continue</span>
          <span className="hidden sm:inline">Continue</span>
        </Button>
      )}

      {/* Report - Primary action when completed */}
      {show.report && !show.continue && onViewReport && (
        <Button
          onClick={onViewReport}
          onPointerDown={spawnRipple}
          disabled={disabled}
          variant="ghost"
          className={cn(
            baseButtonClass,
            materialSurfaceClass,
            btnBase,
            minH,
            "group/report relative overflow-hidden rounded-xl",
            PORTAL_CTA,
            "text-xs sm:text-sm px-4 sm:px-5",
            "flex items-center justify-center gap-2",
            "shadow-md transition-[transform,box-shadow,background-color] duration-300 ease-out",
            "hover:-translate-y-0.5 hover:scale-[1.03] hover:shadow-lg",
            "active:translate-y-0 active:scale-[0.97] active:shadow-md",
          )}
          style={{ ["--material-ink" as string]: "#ffffff" }}
        >
          <FileBarChart className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0 transition-transform duration-300 group-hover/report:scale-110 group-hover/report:-rotate-6" />
          <span className="sm:hidden">Report</span>
          <span className="hidden sm:inline">View Report</span>
        </Button>
      )}

      {/* Retake - Secondary when completed + can retake (not when continue is shown) */}
      {show.retake && !show.continue && onRetake && (
        <Button
          onClick={onRetake}
          disabled={disabled}
          variant="ghost"
          className={cn(
            baseButtonClass,
            btnBase,
            minH,
            "rounded-xl",
            "text-xs sm:text-sm px-4 sm:px-5",
            "flex items-center justify-center gap-2",
            retakeAppearance === "neutral"
              ? PORTAL_OUTLINE_BTN
              : cn(
                  "border-2 border-emerald-300 dark:border-emerald-600",
                  "bg-[var(--card)] text-emerald-700 dark:text-emerald-300",
                  "hover:bg-emerald-500 hover:text-white hover:border-emerald-500",
                  "dark:hover:bg-emerald-600 dark:hover:text-white dark:hover:border-emerald-600",
                ),
          )}
        >
          <RefreshCw className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
          Retake
        </Button>
      )}

      {/* Extend / Rollover (not when continue is shown) */}
      {show.extend && !show.continue && onExtend && (
        <Button
          onClick={onExtend}
          disabled={disabled || extending}
          className={cn(
            baseButtonClass,
            btnBase,
            minH,
            "rounded-xl shadow-md hover:shadow-lg",
            "bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700",
            "text-white border-0",
            "text-xs sm:text-sm px-4 sm:px-5",
            "flex items-center justify-center gap-2"
          )}
        >
          <Timer className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
          {extending ? "Applying..." : extendLabel}
        </Button>
      )}

      {/* Start - Primary CTA when not completed (not when continue is shown) */}
      {show.start && !show.continue && onStart && (
        <Button
          onClick={onStart}
          disabled={disabled}
          variant="ghost"
          className={cn(
            baseButtonClass,
            btnBase,
            minH,
            "rounded-xl shadow-lg hover:shadow-xl",
            PORTAL_CTA,
            "text-xs sm:text-sm px-4 sm:px-5",
            "flex items-center justify-center gap-2",
          )}
        >
          <Zap className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
          <span className="sm:hidden">
            {startLabel ? startLabel.split(/\s+/)[0] : "Start"}
          </span>
          <span className="hidden sm:inline">
            {startLabel ?? `Start ${assessmentLabel}`}
          </span>
        </Button>
      )}

      {/* Closed / Overdue (not when continue is shown) */}
      {show.closed && !show.continue && (
        <Button
          variant="outline"
          disabled
          className={cn(
            btnBase,
            minH,
            "rounded-xl border-2 border-red-200 dark:border-red-800",
            "bg-red-50/80 dark:bg-red-900/20",
            "text-red-600 dark:text-red-400",
            "text-xs sm:text-sm px-4 sm:px-5",
            "flex items-center justify-center gap-2 opacity-75"
          )}
        >
          <AlertCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
          {closedLabel}
        </Button>
      )}

      {/* Locked / Not Available (not when continue is shown) */}
      {show.locked && !show.continue && (
        <Button
          type="button"
          variant="outline"
          disabled={disabled && !onLockedInfo}
          onClick={onLockedInfo}
          className={cn(
            btnBase,
            minH,
            "rounded-xl border-2 border-slate-200 dark:border-slate-600",
            "bg-slate-50 dark:bg-slate-800/50",
            "text-slate-500 dark:text-slate-400",
            "text-xs sm:text-sm px-4 sm:px-5",
            "flex items-center justify-center gap-2",
            onLockedInfo && !disabled && "cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800",
          )}
        >
          <Lock className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
          {lockedLabel ? (
            <span className="truncate">{lockedLabel}</span>
          ) : (
            <>
              <span className="sm:hidden">Locked</span>
              <span className="hidden sm:inline">Not Available</span>
            </>
          )}
        </Button>
      )}
    </div>
  )
}
