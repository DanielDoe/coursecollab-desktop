"use client"

import { cn } from "@/lib/utils"
import { workflowStepIndex, workflowStepsForMode } from "@/lib/schedule-adjustment/types"
import type { ScheduleAdjustmentStatus } from "@/lib/schedule-adjustment/types"

export function ScheduleAdjustmentStepper({
  status,
  adjustmentMode,
  className,
}: {
  status: ScheduleAdjustmentStatus
  adjustmentMode?: string | null
  className?: string
}) {
  const steps = workflowStepsForMode(adjustmentMode)
  const active = workflowStepIndex(status, adjustmentMode)
  const current = steps[Math.max(0, active - 1)]
  const total = steps.length

  return (
    <div className={cn("w-full", className)}>
      <div className="sm:hidden">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm font-semibold text-[var(--cc-accent-dark)]">{current?.label}</p>
          <p className="shrink-0 text-xs text-[var(--cc-text-muted)]">
            Step {Math.min(active, total)} of {total}
          </p>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--muted)]">
          <div
            className="h-full rounded-full bg-[var(--cc-accent)]"
            style={{ width: `${Math.round((Math.min(active, total) / total) * 100)}%` }}
          />
        </div>
      </div>

      <div className="hidden overflow-x-auto sm:block">
        <div className="flex min-w-[36rem] gap-2">
          {steps.map((step, index) => {
            const stepNumber = index + 1
            const reached = stepNumber <= active
            return (
              <div key={step.key} className="min-w-0 flex-1">
                <div className={cn("h-1 rounded-full", reached ? "bg-[var(--cc-accent)]" : "bg-[var(--muted)]")} />
                <p
                  className={cn(
                    "mt-2 text-[10px] font-medium leading-tight md:text-xs",
                    reached ? "text-[var(--cc-accent-dark)]" : "text-[var(--cc-text-muted)]",
                  )}
                >
                  {step.label}
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
