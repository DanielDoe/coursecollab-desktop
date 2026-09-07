"use client"

import {
  FLASHCARD_DIFFICULTY_LABELS,
  FLASHCARD_DIFFICULTY_VALUES,
  type FlashcardDifficulty,
} from "@/lib/flashcards-types"
import { flashcardDifficultyBadgeStyle } from "@/lib/flashcard-difficulty-theme"
import { cn } from "@/lib/utils"

type Props = {
  value: FlashcardDifficulty
  onChange: (value: FlashcardDifficulty) => void
  className?: string
}

export function FlashcardDifficultyPicker({ value, onChange, className }: Props) {
  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--cc-text-muted)]">
        Difficulty
      </p>
      <div className="flex flex-wrap gap-2">
        {FLASHCARD_DIFFICULTY_VALUES.map((level) => {
          const selected = value === level
          const badge = flashcardDifficultyBadgeStyle(level)
          return (
            <button
              key={level}
              type="button"
              onClick={() => onChange(level)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-bold transition-colors",
                !selected &&
                  "border-[var(--border)] bg-[var(--muted)]/50 text-[var(--cc-text-muted)] hover:bg-[var(--muted)]",
              )}
              style={
                selected
                  ? {
                      backgroundColor: badge.backgroundColor,
                      color: badge.color,
                      borderColor: badge.borderColor,
                    }
                  : undefined
              }
              aria-pressed={selected}
            >
              {FLASHCARD_DIFFICULTY_LABELS[level]}
            </button>
          )
        })}
      </div>
    </div>
  )
}
