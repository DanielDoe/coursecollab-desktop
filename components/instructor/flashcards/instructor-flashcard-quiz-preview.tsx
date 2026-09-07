"use client"

import { useEffect, useMemo, useState } from "react"
import type { FlashcardCard } from "@/lib/flashcards-types"
import { buildFlashcardMcq, canUseFlashcardMcq } from "@/lib/flashcard-quiz"
import { FlashcardMcqChoices, FlashcardMcqPrompt } from "@/components/flashcards/flashcard-mcq-ui"
import { FacultyContentNavigator } from "@/components/instructor/dashboard-v2/FacultyContentNavigator"
import { cn } from "@/lib/utils"

type Props = {
  cards: FlashcardCard[]
  activeCardId?: number | null
  onActiveCardIdChange?: (cardId: number) => void
  className?: string
}

export function InstructorFlashcardQuizPreview({
  cards,
  activeCardId,
  onActiveCardIdChange,
  className,
}: Props) {
  const [internalIndex, setInternalIndex] = useState(0)

  const activeIndex = useMemo(() => {
    if (activeCardId != null) {
      const idx = cards.findIndex((c) => c.id === activeCardId)
      if (idx >= 0) return idx
    }
    return Math.min(internalIndex, Math.max(cards.length - 1, 0))
  }, [activeCardId, cards, internalIndex])

  useEffect(() => {
    if (activeCardId != null) {
      const idx = cards.findIndex((c) => c.id === activeCardId)
      if (idx >= 0) setInternalIndex(idx)
    }
  }, [activeCardId, cards])

  const setIndex = (nextIndex: number) => {
    const clamped = Math.max(0, Math.min(nextIndex, cards.length - 1))
    setInternalIndex(clamped)
    const nextCard = cards[clamped]
    if (nextCard && onActiveCardIdChange) onActiveCardIdChange(nextCard.id)
  }

  const target = cards[activeIndex]
  const mcq = useMemo(() => {
    if (!target || !canUseFlashcardMcq(cards)) return null
    return buildFlashcardMcq(target, cards)
  }, [cards, target])

  if (cards.length === 0) {
    return (
      <p className={cn("text-xs text-muted-foreground", className)}>
        Add cards to preview how students will be quizzed.
      </p>
    )
  }

  if (!canUseFlashcardMcq(cards)) {
    return (
      <p className={cn("text-xs text-muted-foreground", className)}>
        Add at least two cards with front and back text to enable quiz preview.
      </p>
    )
  }

  if (!target) return null

  return (
    <div className={cn("space-y-3", className)}>
      {!mcq ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] px-4 py-6 text-center text-xs text-muted-foreground">
          Could not build a quiz for card {activeIndex + 1} — check front and back text.
        </div>
      ) : (
        <div className="space-y-3">
          <FlashcardMcqPrompt
            mcq={mcq}
            badge={`Preview · ${activeIndex + 1}/${cards.length}`}
            variant="quiz"
          />
          <FlashcardMcqChoices mcq={mcq} previewCorrect />
        </div>
      )}

      {cards.length > 1 ? (
        <>
          <div className="flex flex-wrap items-center justify-center gap-1.5 px-1">
            {cards.map((c, i) => {
              const active = i === activeIndex
              return (
                <button
                  key={c.id}
                  type="button"
                  title={c.frontText.trim() || `Card ${i + 1}`}
                  onClick={() => setIndex(i)}
                  className={cn(
                    "inline-flex h-8 min-w-8 items-center justify-center rounded-lg border px-2 text-xs font-semibold tabular-nums transition-colors",
                    active
                      ? "border-violet-400/80 bg-violet-600 text-white shadow-sm dark:border-violet-500 dark:bg-violet-600"
                      : "border-[var(--border)] bg-background/80 text-muted-foreground hover:border-violet-300/60 hover:text-foreground",
                  )}
                >
                  {i + 1}
                </button>
              )
            })}
          </div>
          <FacultyContentNavigator
            currentIndex={activeIndex}
            total={cards.length}
            onPrevious={() => setIndex(activeIndex - 1)}
            onNext={() => setIndex(activeIndex + 1)}
            itemLabel="card"
            size="sm"
          />
        </>
      ) : null}
    </div>
  )
}
