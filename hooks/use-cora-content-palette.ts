"use client"

import { useMemo } from "react"
import { useCoraChrome } from "@/hooks/use-cora-chrome"
import { coraChromeKpi, type CoraChrome } from "@/lib/cora/cora-chrome-theme"
import type { SolidListThumb } from "@/lib/student-color-hunt-theme"

/** Theme palette helpers for Cora tab *content* (not per-tab accents). */
export type CoraContentPalette = {
  chrome: CoraChrome
  /** Brand CTA — same across tabs */
  cta: SolidListThumb
  /** Soft hero wash */
  hero: SolidListThumb
  soft: string
  mid: string
  accent: string
  deep: string
  /** Cycle Color Hunt stops from the selected theme for cards/chips/icons */
  tone: (index: number) => SolidListThumb
}

export function useCoraContentPalette(): CoraContentPalette {
  const chrome = useCoraChrome()
  return useMemo(
    () => ({
      chrome,
      cta: chrome.roles.cta,
      hero: chrome.roles.hero,
      soft: chrome.soft,
      mid: chrome.mid,
      accent: chrome.accent,
      deep: chrome.deep,
      tone: (index: number) => coraChromeKpi(index, chrome.roles),
    }),
    [chrome],
  )
}
