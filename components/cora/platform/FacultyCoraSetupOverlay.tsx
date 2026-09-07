"use client"

import { CoraLogo } from "@/components/cora/CoraLogo"
import { FACULTY_CORA_SETUP_STEPS, type FacultyCoraSetupStepId } from "@/hooks/use-faculty-cora-context"
import { FACULTY_CORA_PLATFORM_TITLE, FACULTY_CORA_TAGLINE } from "@/lib/cora/constants"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type Props = {
  open: boolean
  step: FacultyCoraSetupStepId
  error?: string | null
  onRetry?: () => void
  onDismiss?: () => void
}

export function FacultyCoraSetupOverlay({ open, step, error, onRetry, onDismiss }: Props) {
  if (!open) return null

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-[color-mix(in_srgb,var(--background)_82%,transparent)] backdrop-blur-sm">
      <div className="mx-4 w-full max-w-md rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-xl">
        <div className="flex items-center gap-3">
          <CoraLogo size="md" />
          <div>
            <p className="text-sm font-semibold text-[var(--cc-text)]">{FACULTY_CORA_PLATFORM_TITLE}</p>
            <p className="text-xs text-[var(--cc-text-muted)]">{FACULTY_CORA_TAGLINE}</p>
          </div>
        </div>

        <ul className="mt-5 space-y-2">
          {FACULTY_CORA_SETUP_STEPS.map((entry) => {
            const active = entry.id === step
            const done =
              FACULTY_CORA_SETUP_STEPS.findIndex((s) => s.id === entry.id) <
              FACULTY_CORA_SETUP_STEPS.findIndex((s) => s.id === step)
            return (
              <li
                key={entry.id}
                className={cn(
                  "rounded-xl px-3 py-2 text-sm",
                  active && "bg-[var(--muted)] font-medium text-[var(--cc-text)]",
                  done && "text-[var(--cc-text-muted)]",
                  !active && !done && "text-[var(--cc-text-muted)]/70",
                )}
              >
                {entry.label}
              </li>
            )
          })}
        </ul>

        {error ? (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-red-600 dark:text-red-300">{error}</p>
            <div className="flex flex-wrap gap-2">
              {onRetry ? (
                <Button type="button" onClick={onRetry} className="rounded-xl">
                  Retry setup
                </Button>
              ) : null}
              {onDismiss ? (
                <Button type="button" variant="outline" onClick={onDismiss} className="rounded-xl">
                  Continue to Cora
                </Button>
              ) : null}
            </div>
          </div>
        ) : onDismiss ? (
          <Button type="button" variant="ghost" onClick={onDismiss} className="mt-4 w-full rounded-xl">
            Continue without waiting
          </Button>
        ) : null}
      </div>
    </div>
  )
}
