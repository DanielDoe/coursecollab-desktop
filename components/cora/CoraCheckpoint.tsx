"use client"

import { useState } from "react"
import { CoraMathText } from "@/components/cora/CoraMathText"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { cn } from "@/lib/utils"
import type { CoraCheckpoint as CoraCheckpointType } from "@/lib/cora/step-engine/types"

type Props = {
  checkpoint: CoraCheckpointType
  result?: boolean
  onAnswer: (checkpointId: string, optionId: string, correct: boolean) => void
}

export function CoraCheckpoint({ checkpoint, result, onAnswer }: Props) {
  const [picked, setPicked] = useState<string | null>(null)
  const answered = result !== undefined
  const locked = result === true

  return (
    <div className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--cc-background)]/70 p-4">
      <CoraMathText text={checkpoint.prompt} compact className="text-sm font-semibold text-[var(--cc-text)]" />
      <RadioGroup
        value={picked ?? ""}
        disabled={locked}
        onValueChange={(optionId) => {
          const option = checkpoint.options.find((item) => item.id === optionId)
          if (!option || locked) return
          setPicked(optionId)
          onAnswer(checkpoint.id, option.id, option.correct)
        }}
        className="gap-2"
        aria-label={checkpoint.prompt}
      >
        {checkpoint.options.map((opt) => {
          const id = `${checkpoint.id}-${opt.id}`
          const selected = picked === opt.id
          const showCorrect = answered && selected && result === true
          const showWrong = answered && selected && result === false
          return (
            <label
              key={opt.id}
              htmlFor={id}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition-all",
                showCorrect
                  ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
                  : showWrong
                    ? "border-red-300/50 bg-red-50/80 text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200"
                    : "border-[var(--border)] hover:border-[var(--cc-accent-border)] hover:bg-[var(--muted)]/30",
                locked && "cursor-default",
              )}
            >
              <RadioGroupItem value={opt.id} id={id} className="mt-0.5" />
              <CoraMathText text={opt.label} compact className="min-w-0 flex-1 text-sm" />
            </label>
          )
        })}
      </RadioGroup>
      {!answered ? (
        <p className="text-xs text-[var(--cc-text-muted)]">Choose an option to continue.</p>
      ) : null}
      {answered && checkpoint.misconception && result === false ? (
        <CoraMathText text={checkpoint.misconception} compact className="text-xs text-[var(--cc-text-muted)]" />
      ) : null}
      {answered && result === false ? (
        <p className="text-xs font-medium text-amber-700 dark:text-amber-300">Try again — focus on what this step is asking.</p>
      ) : null}
    </div>
  )
}
