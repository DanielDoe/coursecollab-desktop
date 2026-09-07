"use client"

import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

export type QuestionBankFlowStep = {
  id: string
  label: string
}

export function QuestionBankFlowStepIndicator({
  steps,
  currentIndex,
  className,
}: {
  steps: QuestionBankFlowStep[]
  currentIndex: number
  className?: string
}) {
  return (
    <nav aria-label="Progress" className={cn("mx-auto w-full max-w-md px-2", className)}>
      <ol className="flex items-start justify-center">
        {steps.map((step, idx) => {
          const done = idx < currentIndex
          const active = idx === currentIndex
          const pending = idx > currentIndex

          return (
            <li key={step.id} className="relative flex flex-1 flex-col items-center">
              {idx < steps.length - 1 ? (
                <span
                  aria-hidden
                  className={cn(
                    "absolute left-[calc(50%+1.125rem)] top-4 h-0.5 w-[calc(100%-2.25rem)] -translate-y-1/2 rounded-full",
                    done ? "bg-emerald-400/80 dark:bg-emerald-500/70" : "bg-slate-200 dark:bg-white/10",
                  )}
                />
              ) : null}

              <div
                className={cn(
                  "relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors",
                  done && "border-emerald-500 bg-emerald-500 text-white",
                  active && "border-[var(--cc-accent-dark)] bg-[var(--cc-accent-dark)] text-white shadow-sm",
                  pending && "border-slate-200 bg-white text-slate-400 dark:border-white/15 dark:bg-slate-950 dark:text-slate-500",
                )}
              >
                {done ? <Check className="h-4 w-4" strokeWidth={2.5} /> : idx + 1}
              </div>

              <span
                className={cn(
                  "mt-2 max-w-[5.5rem] text-center text-[11px] font-medium leading-tight sm:max-w-none sm:text-xs",
                  done && "text-emerald-700 dark:text-emerald-300",
                  active && "text-[var(--cc-accent-dark)]",
                  pending && "text-slate-400 dark:text-slate-500",
                )}
              >
                {step.label}
              </span>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
