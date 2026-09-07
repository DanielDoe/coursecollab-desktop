"use client"

import { useEffect, useState } from "react"
import { getStudentAuthHeaders, studentApiFetch } from "@/lib/auth"
import type { FlashcardDeckMastery } from "@/lib/flashcard-gamification"

let cache: Record<string, FlashcardDeckMastery> | null = null
let cacheAt = 0

export const FLASHCARD_MASTERY_INVALIDATE = "flashcard-mastery-invalidate"

function fetchDeckMastery(): Promise<Record<string, FlashcardDeckMastery>> {
  return studentApiFetch("/api/student/flashcards/gamification", { headers: getStudentAuthHeaders() })
    .then((r) => r.json())
    .then((data) => {
      const next = (data.deckMastery ?? {}) as Record<string, FlashcardDeckMastery>
      cache = next
      cacheAt = Date.now()
      return next
    })
}

export function useFlashcardDeckMastery() {
  const [deckMastery, setDeckMastery] = useState<Record<string, FlashcardDeckMastery>>(cache ?? {})

  useEffect(() => {
    const load = () => {
      if (cache && Date.now() - cacheAt < 30_000) {
        setDeckMastery(cache)
        return
      }
      void fetchDeckMastery().then(setDeckMastery).catch(() => {})
    }

    load()
    window.addEventListener(FLASHCARD_MASTERY_INVALIDATE, load)
    return () => window.removeEventListener(FLASHCARD_MASTERY_INVALIDATE, load)
  }, [])

  return deckMastery
}

export function invalidateFlashcardMasteryCache() {
  cache = null
  cacheAt = 0
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(FLASHCARD_MASTERY_INVALIDATE))
  }
}
