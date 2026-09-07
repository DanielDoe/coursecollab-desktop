"use client"

import { useMemo } from "react"
import { useAppearance } from "@/components/appearance/AppearanceProvider"
import { resolveCodebenchChrome, type CodebenchChrome } from "@/lib/codebench-chrome-theme"

/** Theme-aware CodeBench hub chrome — Color Hunt family variety per hue. */
export function useCodebenchChrome(): CodebenchChrome {
  const { themeId, tokens } = useAppearance()
  return useMemo(() => resolveCodebenchChrome(themeId, tokens), [themeId, tokens])
}
