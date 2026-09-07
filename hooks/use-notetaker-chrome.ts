"use client"

import { useMemo } from "react"
import { useAppearance } from "@/components/appearance/AppearanceProvider"
import { resolveNotetakerChrome, type NotetakerChrome } from "@/lib/notetaker-list-theme"

/** Theme-aware AI Notetaker chrome — tracks shell accent. */
export function useNotetakerChrome(): NotetakerChrome & { isDark: boolean } {
  const { themeId, tokens, isDark } = useAppearance()
  const chrome = useMemo(() => resolveNotetakerChrome(themeId, tokens), [themeId, tokens])
  return { ...chrome, isDark }
}
