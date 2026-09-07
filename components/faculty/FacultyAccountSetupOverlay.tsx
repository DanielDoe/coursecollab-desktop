"use client"

import { Check, Circle, GraduationCap } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  FACULTY_ACCOUNT_SETUP_STEPS,
  type FacultyAccountSetupStepId,
  type FacultySetupCheck,
} from "@/lib/faculty-account-setup-shared"

function stepIndex(step: FacultyAccountSetupStepId): number {
  return FACULTY_ACCOUNT_SETUP_STEPS.findIndex((row) => row.id === step)
}

export function FacultyAccountSetupOverlay({
  visible,
  activeStep,
  checks,
  error,
  onRetry,
}: {
  visible: boolean
  activeStep: FacultyAccountSetupStepId
  checks?: FacultySetupCheck[]
  error?: string | null
  onRetry?: () => void
}) {
  if (!visible) return null
  const activeIndex = Math.max(0, stepIndex(activeStep))

  return (
    <div className="access-status-page cc-brand-surface cc-brand-auth fixed inset-0 z-[70] flex items-center justify-center px-5">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,color-mix(in_srgb,var(--cc-accent)_18%,transparent)_0%,transparent_55%)] opacity-80" />
      <div className="relative w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-600 dark:text-violet-300">
            <GraduationCap className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-[var(--cc-text)]">
            Setting up your faculty account
          </h1>
          <p className="max-w-sm text-sm leading-relaxed text-[var(--cc-text-secondary)]">
            We&apos;re loading your courses and teaching workspace. This only runs once for new accounts.
          </p>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm">
          <ul className="space-y-3">
            {FACULTY_ACCOUNT_SETUP_STEPS.map((step, index) => {
              const done = index < activeIndex || (activeStep === "ready" && index <= activeIndex)
              const active = index === activeIndex && activeStep !== "ready" && !error
              const check = checks?.find((c) => {
                if (step.id === "verify_account") return c.id === "account" || c.id === "lifecycle"
                if (step.id === "load_courses") return c.id === "assignments"
                if (step.id === "import_course") return c.id === "import"
                if (step.id === "link_term") return c.id === "term"
                if (step.id === "sync_permissions") return c.id === "permissions"
                if (step.id === "ready") return c.id === "ready"
                return false
              })
              const failed = check && !check.ok && index <= activeIndex

              return (
                <li key={step.id} className="flex items-center gap-3">
                  <span
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-full",
                      done && !failed && "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
                      active && "bg-violet-500/15 text-violet-600 dark:text-violet-300",
                      failed && "bg-red-500/15 text-red-600 dark:text-red-300",
                      !done && !active && !failed && "bg-[var(--muted)] text-[var(--cc-text-muted)]",
                    )}
                  >
                    {done && !failed ? (
                      <Check className="h-4 w-4" />
                    ) : active ? (
                      <span className="size-4 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
                    ) : (
                      <Circle className="h-3.5 w-3.5" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <span
                      className={cn(
                        "text-sm",
                        active && "font-semibold text-[var(--cc-text)]",
                        done && !failed && "text-[var(--cc-text-secondary)]",
                        failed && "font-medium text-red-700 dark:text-red-300",
                        !done && !active && !failed && "text-[var(--cc-text-muted)]",
                      )}
                    >
                      {step.label}
                    </span>
                    {check?.detail ? (
                      <p className="truncate text-xs text-[var(--cc-text-muted)]">{check.detail}</p>
                    ) : null}
                  </div>
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
