"use client"

import { Check, Circle } from "lucide-react"
import { CoraLogo } from "@/components/cora/CoraLogo"
import { CORA_NAME } from "@/lib/cora/constants"
import {
  STUDENT_CORA_SETUP_STEPS,
  type StudentCoraSetupStepId,
} from "@/lib/cora/student-cora-context"
import { cn } from "@/lib/utils"

type Props = {
  visible: boolean
  activeStep: StudentCoraSetupStepId
  courseLabel?: string
  focusLabel?: string
  error?: string | null
  onRetry?: () => void
}

function stepIndex(step: StudentCoraSetupStepId): number {
  return STUDENT_CORA_SETUP_STEPS.findIndex((row) => row.id === step)
}

export function StudentCoraSetupOverlay({
  visible,
  activeStep,
  courseLabel,
  focusLabel,
  error,
  onRetry,
}: Props) {
  if (!visible) return null
  const activeIndex = Math.max(0, stepIndex(activeStep))

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#f6f3fb] px-5 dark:bg-[var(--cc-background)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,#e8ddf7_0%,transparent_55%)] opacity-80 dark:opacity-30" />
      <div className="relative w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <CoraLogo size="lg" />
          <h1 className="text-xl font-semibold tracking-tight text-[var(--cc-text)]">
            Preparing your study assistant
          </h1>
          <p className="max-w-sm text-sm leading-relaxed text-[var(--cc-text-secondary)]">
            {courseLabel
              ? `Reading ${courseLabel} so suggestions match what you're working on.`
              : `Reading your course context so ${CORA_NAME} stays relevant.`}
          </p>
          {focusLabel ? (
            <p className="text-xs font-medium text-violet-700 dark:text-violet-300">
              Current focus: {focusLabel}
            </p>
          ) : null}
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm">
          <ul className="space-y-3">
            {STUDENT_CORA_SETUP_STEPS.map((step, index) => {
              const done = index < activeIndex
              const active = index === activeIndex && !error
              return (
                <li key={step.id} className="flex items-center gap-3">
                  <span
                    className={cn(
                      "flex size-8 items-center justify-center rounded-full",
                      done && "bg-emerald-500/15 text-emerald-600",
                      active && "bg-violet-500/15 text-violet-600",
                      !done && !active && "bg-[var(--muted)] text-[var(--cc-text-muted)]",
                    )}
                  >
                    {done ? (
                      <Check className="h-4 w-4" />
                    ) : active ? (
                      <span className="size-4 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
                    ) : (
                      <Circle className="h-3.5 w-3.5" />
                    )}
                  </span>
                  <span
                    className={cn(
                      "text-sm",
                      active && "font-semibold text-[var(--cc-text)]",
                      done && "text-[var(--cc-text-secondary)]",
                      !done && !active && "text-[var(--cc-text-muted)]",
                    )}
                  >
                    {step.label}
                    {active && step.id === "generating" ? "…" : ""}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-center dark:border-red-900/50 dark:bg-red-950/40">
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            {onRetry ? (
              <button
                type="button"
                onClick={onRetry}
                className="mt-3 rounded-full bg-red-700 px-4 py-2 text-xs font-medium text-white"
              >
                Try again
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
