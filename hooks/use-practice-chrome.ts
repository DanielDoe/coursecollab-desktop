"use client"

import { useMemo } from "react"
import { useAppearance } from "@/components/appearance/AppearanceProvider"
import { resolvePracticeChrome, type PracticeChrome } from "@/lib/practice-chrome-theme"

/** Theme-aware practice hub chrome — Color Hunt family variety per hue. */
export function usePracticeChrome(): PracticeChrome {
  const { themeId, tokens } = useAppearance()
  return useMemo(() => resolvePracticeChrome(themeId, tokens), [themeId, tokens])
}
