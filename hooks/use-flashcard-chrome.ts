"use client"

import { useMemo } from "react"
import { useAppearance } from "@/components/appearance/AppearanceProvider"
import { resolveFlashcardChrome, type FlashcardChrome } from "@/lib/flashcard-list-theme"

/** Theme-aware flashcard list chrome — tracks shell accent. */
export function useFlashcardChrome(): FlashcardChrome & { isDark: boolean } {
  const { themeId, tokens, isDark } = useAppearance()
  const chrome = useMemo(() => resolveFlashcardChrome(themeId, tokens), [themeId, tokens])
  return { ...chrome, isDark }
}
