"use client"

import { useMemo } from "react"
import { useAppearance } from "@/components/appearance/AppearanceProvider"
import { resolveNotesChrome, type NotesChrome } from "@/lib/notes-list-theme"

/** Theme-aware notes chrome — shared by student + faculty portals. */
export function useNotesChrome(): NotesChrome & { isDark: boolean } {
  const { themeId, tokens, isDark } = useAppearance()
  const chrome = useMemo(() => resolveNotesChrome(themeId, tokens), [themeId, tokens])
  return { ...chrome, isDark }
}
