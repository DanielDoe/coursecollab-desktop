"use client"

import { cn } from "@/lib/utils"

export type CareerWorkflowStep = {
  title: string
}

export function CareerWorkflowStepper({
  steps,
  activeStep,
  className,
}: {
  steps: CareerWorkflowStep[]
  /** 1-based index of the current step */
  activeStep: number
  className?: string
}) {
  return (
    <div className={cn("mx-auto w-full max-w-2xl px-2", className)}>
      <div
        className="grid gap-4 sm:gap-6"
        style={{ gridTemplateColumns: `repeat(${Math.max(steps.length, 1)}, minmax(0, 1fr))` }}
      >
        {steps.map((step, index) => {
          const stepNumber = index + 1
          const isReached = stepNumber <= activeStep

          return (
            <div key={step.title} className="min-w-0 text-center sm:text-left">
              <div
                className={cn(
                  "h-1 rounded-full transition-colors",
                  isReached ? "bg-violet-600" : "bg-[var(--muted)]",
                )}
              />
              <p
                className={cn(
                  "mt-2 text-xs font-medium",
                  isReached ? "text-violet-600" : "text-[var(--cc-text-muted)]",
                )}
              >
                Step {stepNumber}
              </p>
              <p className="mt-0.5 text-sm font-semibold leading-snug text-[var(--cc-text)] sm:text-base">
                {step.title}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export const COVER_LETTER_WORKFLOW_STEPS: CareerWorkflowStep[] = [
  { title: "Upload résumé & paste opportunity" },
  { title: "Generate cover letter" },
]
