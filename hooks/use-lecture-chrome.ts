"use client"

import { useMemo } from "react"
import { useAppearance } from "@/components/appearance/AppearanceProvider"
import { resolveLectureChrome, type LectureChrome } from "@/lib/lecture-chrome-theme"

/** Theme-aware lecture chrome — tracks shell accent; Color Hunt is suggestion-only. */
export function useLectureChrome(): LectureChrome {
  const { themeId, tokens } = useAppearance()
  return useMemo(() => resolveLectureChrome(themeId, tokens), [themeId, tokens])
}
