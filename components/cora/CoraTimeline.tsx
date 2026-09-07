"use client"

import { motion } from "framer-motion"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { PHASE_LABELS } from "@/lib/cora/step-engine/phases"
import type { CoraStep } from "@/lib/cora/step-engine/types"

type Props = {
  steps: CoraStep[]
  stepIndex: number
  completedIds: Set<string>
  accent: string
  onSelect: (index: number) => void
}

export function CoraTimeline({ steps, stepIndex, completedIds, accent, onSelect }: Props) {
  return (
    <aside className="hidden min-h-0 flex-col overflow-y-auto bg-[var(--muted)]/20 p-5 lg:flex">
      <p className="mb-4 text-[10px] font-bold uppercase tracking-widest text-[var(--cc-text-muted)]">Timeline</p>
      <ol className="space-y-1.5">
        {steps.map((step, i) => {
          const active = i === stepIndex
          const done = completedIds.has(step.id)
          return (
            <li key={step.id}>
              <button
                type="button"
                onClick={() => onSelect(i)}
                className={cn(
                  "group flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-all",
                  active ? "bg-[var(--card)] shadow-sm" : "hover:bg-[var(--card)]/60",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold transition-all",
                    done
                      ? cn("bg-gradient-to-br text-white", accent)
                      : active
                        ? "border-2 border-[var(--cc-accent)] text-[var(--cc-accent)]"
                        : "border border-[var(--border)] text-[var(--cc-text-muted)]",
                  )}
                >
                  {done ? <Check className="h-3 w-3" /> : i + 1}
                </span>
                <span className="min-w-0">
                  <span className="block text-[10px] font-semibold uppercase tracking-wide text-[var(--cc-text-muted)]">
                    {PHASE_LABELS[step.phase]}
                  </span>
                  <span className={cn("block truncate text-sm font-medium", active ? "text-[var(--cc-text)]" : "text-[var(--cc-text-secondary)]")}>
                    {step.title}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </aside>
  )
}
