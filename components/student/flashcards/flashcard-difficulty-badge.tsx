"use client"

import {
  FLASHCARD_DIFFICULTY_LABELS,
  normalizeFlashcardDifficulty,
  type FlashcardDifficulty,
} from "@/lib/flashcards-types"
import { flashcardDifficultyBadgeStyle } from "@/lib/flashcard-difficulty-theme"
import { cn } from "@/lib/utils"

type Props = {
  difficulty?: FlashcardDifficulty | string | null
  compact?: boolean
  className?: string
}

export function FlashcardDifficultyBadge({ difficulty, compact = false, className }: Props) {
  const normalized = normalizeFlashcardDifficulty(difficulty)
  const style = flashcardDifficultyBadgeStyle(normalized)

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border font-bold tracking-wide",
        compact ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]",
        className,
      )}
      style={{
        backgroundColor: style.backgroundColor,
        color: style.color,
        borderColor: style.borderColor,
      }}
    >
      {FLASHCARD_DIFFICULTY_LABELS[normalized]}
    </span>
  )
}
