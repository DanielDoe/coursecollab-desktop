"use client"

import { cn } from "@/lib/utils"
import type { CoraCheckpoint as CoraCheckpointType } from "@/lib/cora/step-engine/types"

type Props = {
  checkpoint: CoraCheckpointType
  result?: boolean
  onAnswer: (checkpointId: string, optionId: string, correct: boolean) => void
}

export function CoraCheckpoint({ checkpoint, result, onAnswer }: Props) {
  const answered = result !== undefined

  return (
    <div className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--cc-background)]/70 p-4">
      <p className="text-sm font-semibold text-[var(--cc-text)]">{checkpoint.prompt}</p>
      <div className="space-y-2">
        {checkpoint.options.map((opt) => {
          const selected = answered && result === opt.correct && opt.correct
          const wrong = answered && !result && !opt.correct
          return (
            <button
              key={opt.id}
              type="button"
              disabled={answered && result === true}
              onClick={() => onAnswer(checkpoint.id, opt.id, opt.correct)}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition-all",
                selected
                  ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
                  : wrong
                    ? "border-red-300/50 bg-red-50/80 text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200"
                    : "border-[var(--border)] hover:border-[var(--cc-accent-border)] hover:bg-[var(--muted)]/30",
              )}
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-current text-[10px] font-bold">
                {opt.id.slice(0, 1).toUpperCase()}
              </span>
              {opt.label}
            </button>
          )
        })}
      </div>
      {answered && checkpoint.misconception && result === false ? (
        <p className="text-xs text-[var(--cc-text-muted)]">{checkpoint.misconception}</p>
      ) : null}
      {answered && result === false ? (
        <p className="text-xs font-medium text-amber-700 dark:text-amber-300">Try again — focus on what this step is asking.</p>
      ) : null}
    </div>
  )
}
