"use client"

import { useMemo } from "react"
import { useAppearance } from "@/components/appearance/AppearanceProvider"
import { resolveCoraChrome, type CoraChrome } from "@/lib/cora/cora-chrome-theme"

/** Theme-aware Cora platform chrome — Color Hunt family variety per hue. */
export function useCoraChrome(): CoraChrome {
  const { themeId, tokens } = useAppearance()
  return useMemo(() => resolveCoraChrome(themeId, tokens), [themeId, tokens])
}
